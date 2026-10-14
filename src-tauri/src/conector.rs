//! Conector entre o app e a extensão do navegador, por mensagens nativas.
//!
//! O navegador não fala com um app que já está aberto: ele inicia um programa
//! (o "host nativo") e conversa com ele por stdin/stdout. O host é este mesmo
//! executável, chamado pelo navegador com a origem da extensão
//! (chrome-extension://…) como argumento. Nesse modo ele não abre janela:
//! repassa as mensagens entre o navegador e o app aberto, que escuta numa
//! porta local.
//!
//! ```text
//! extensão ⇄ (stdin/stdout, tamanho + JSON) ⇄ host ⇄ (TCP local, JSON por linha) ⇄ app
//! ```
//!
//! A porta e um segredo ficam num arquivo na pasta de dados do app, legível só
//! pelo usuário. O host lê o arquivo e manda o segredo na primeira linha; o app
//! descarta conexão sem ele (outro usuário da mesma máquina, por exemplo).
//!
//! As mensagens passam sem ser interpretadas aqui: são as mesmas do protocolo
//! do conector (src/bridge/protocol.ts), que o editor e a extensão conferem.

use std::collections::hash_map::RandomState;
use std::fs;
use std::hash::{BuildHasher, Hasher};
use std::io::{self, BufRead, BufReader, Read, Write};
use std::net::{Ipv4Addr, Shutdown, TcpListener, TcpStream};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter, State};

/// O canal Dev (feature `canal-dev`): outro host, outro identificador e a
/// extensão do canal Dev, para conviver com o app publicado.
const DEV: bool = cfg!(feature = "canal-dev");

/// Nome do host nativo, o mesmo que a extensão passa a `connectNative`.
pub const HOST_NAME: &str = if DEV {
    "lattes_editor.conector_dev"
} else {
    "lattes_editor.conector"
};

/// Identificador do app (tauri.conf.json, ou src-tauri/tauri.canal-dev.conf.json
/// no canal Dev), que dá nome à pasta de dados.
pub const IDENTIFIER: &str = if DEV {
    "dev.lattes-editor.app.dev"
} else {
    "dev.lattes-editor.app"
};

/// Extensões que podem iniciar o host: a de desenvolvimento, com a chave
/// fixa do manifest (scripts/build-extension.ts). A da Chrome Web Store
/// entra aqui quando for publicada.
const EXTENSION_IDS: &[&str] = if DEV {
    &["alopgghbefjbmjomhgoebbjnmppokkgi"]
} else {
    &["elkaiefkldcngjdgelfjhjbljefbemac"]
};

/// Mensagem maior que isso do navegador é recusada (a fila inteira cabe com folga).
const MAX_MESSAGE: u32 = 8 * 1024 * 1024;

/// O navegador chama o host com a origem da extensão como argumento.
pub fn is_host_invocation() -> bool {
    std::env::args().any(|a| a.starts_with("chrome-extension://"))
}

fn home() -> Option<PathBuf> {
    std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).map(PathBuf::from)
}

/// Pasta de dados do app, a mesma que o Tauri usa (app_data_dir).
fn data_dir() -> Option<PathBuf> {
    let base = if cfg!(target_os = "macos") {
        home()?.join("Library/Application Support")
    } else if cfg!(windows) {
        PathBuf::from(std::env::var_os("APPDATA")?)
    } else {
        std::env::var_os("XDG_DATA_HOME")
            .map(PathBuf::from)
            .or_else(|| Some(home()?.join(".local/share")))?
    };
    Some(base.join(IDENTIFIER))
}

fn port_file() -> Option<PathBuf> {
    Some(data_dir()?.join("conector.txt"))
}

/// 128 bits a partir das chaves do RandomState, que a biblioteca padrão tira
/// do gerador do sistema operacional.
fn secret() -> String {
    let part = || {
        let mut h = RandomState::new().build_hasher();
        let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH);
        h.write_u128(now.map(|d| d.as_nanos()).unwrap_or(0));
        h.finish()
    };
    format!("{:016x}{:016x}", part(), part())
}

// ---------------------------------------------------------------- app

/// Conexão do host com o app aberto (uma por vez: a mais recente vale).
#[derive(Default)]
pub struct Conector {
    /// A ligação atual, com o número dela. Um host novo (outro navegador, uma
    /// extensão recarregada) toma o lugar do anterior; o número diz, quando
    /// uma ligação cai, se ela ainda era a atual.
    conn: Arc<Mutex<Option<(u64, TcpStream)>>>,
}

/// Põe a ligação `id` no lugar da atual e fecha a anterior. Fechar é preciso:
/// a thread de leitura da ligação antiga tem a própria cópia do socket
/// (try_clone), e soltar a guardada aqui não a encerra. Sem o shutdown, o host
/// antigo continuaria ligado, mandando mensagens ao editor.
fn replace_current(conn: &Mutex<Option<(u64, TcpStream)>>, id: u64, stream: TcpStream) {
    let previous = conn.lock().unwrap().replace((id, stream));
    if let Some((_, old)) = previous {
        let _ = old.shutdown(Shutdown::Both);
    }
}

/// Uma ligação que caiu só desliga o conector se ainda era a atual: a queda
/// de um host antigo, depois que um novo tomou o lugar, não muda nada.
fn drop_if_current(conn: &Mutex<Option<(u64, TcpStream)>>, id: u64) -> bool {
    let mut guard = conn.lock().unwrap();
    if guard.as_ref().is_some_and(|(current, _)| *current == id) {
        *guard = None;
        true
    } else {
        false
    }
}

/// Escuta numa porta local e repassa ao editor o que vier da extensão.
/// Eventos para a página: "conector" (mensagem), "conector-ligado" e
/// "conector-desligado".
pub fn start(app: &AppHandle, conector: &Conector) -> io::Result<()> {
    let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0))?;
    let port = listener.local_addr()?.port();
    let token = secret();
    let file = port_file().ok_or_else(|| io::Error::other("pasta de dados não encontrada"))?;
    fs::create_dir_all(file.parent().unwrap_or(&file))?;
    write_private(&file, &format!("{port} {token}\n"))?;

    let conn = Arc::clone(&conector.conn);
    let app = app.clone();
    thread::spawn(move || {
        let mut next_id: u64 = 0;
        for stream in listener.incoming().flatten() {
            let mut reader = BufReader::new(match stream.try_clone() {
                Ok(s) => s,
                Err(_) => continue,
            });
            let mut first = String::new();
            if reader.read_line(&mut first).is_err() || first.trim() != token {
                continue;
            }
            next_id += 1;
            let id = next_id;
            replace_current(&conn, id, stream);
            let _ = app.emit("conector-ligado", ());
            let (app2, conn2) = (app.clone(), Arc::clone(&conn));
            thread::spawn(move || {
                for line in reader.lines() {
                    match line {
                        Ok(l) if !l.is_empty() => {
                            let _ = app2.emit("conector", l);
                        }
                        Ok(_) => {}
                        Err(_) => break,
                    }
                }
                if drop_if_current(&conn2, id) {
                    let _ = app2.emit("conector-desligado", ());
                }
            });
        }
    });
    Ok(())
}

/// Manda uma mensagem do editor para a extensão (JSON numa linha).
#[tauri::command]
pub fn conector_send(conector: State<'_, Conector>, msg: String) -> Result<(), String> {
    let mut guard = conector.conn.lock().unwrap();
    let (_, stream) = guard.as_mut().ok_or("A extensão não está conectada")?;
    let line = msg.replace('\n', " ");
    stream
        .write_all(format!("{line}\n").as_bytes())
        .map_err(|e| format!("Falha ao falar com a extensão: {e}"))
}

#[cfg(unix)]
fn write_private(path: &PathBuf, text: &str) -> io::Result<()> {
    use std::os::unix::fs::OpenOptionsExt;
    let mut f = fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .mode(0o600)
        .open(path)?;
    f.write_all(text.as_bytes())
}

#[cfg(not(unix))]
fn write_private(path: &PathBuf, text: &str) -> io::Result<()> {
    // No Windows, a pasta do perfil (AppData) já é só do usuário.
    fs::write(path, text)
}

// ---------------------------------------------------------------- registro

fn json_string(s: &str) -> String {
    format!("\"{}\"", s.replace('\\', "\\\\").replace('"', "\\\""))
}

fn manifest(exe: &str) -> String {
    let origins: Vec<String> = EXTENSION_IDS
        .iter()
        .map(|id| json_string(&format!("chrome-extension://{id}/")))
        .collect();
    format!(
        "{{\n  \"name\": {},\n  \"description\": \"LattesEditor: conector com a extensão\",\n  \"path\": {},\n  \"type\": \"stdio\",\n  \"allowed_origins\": [{}]\n}}\n",
        json_string(HOST_NAME),
        json_string(exe),
        origins.join(", ")
    )
}

/// Pastas de configuração dos navegadores baseados no Chromium (macOS e Linux).
#[cfg(not(windows))]
fn browser_dirs() -> Vec<PathBuf> {
    let Some(home) = home() else { return vec![] };
    let names: &[&str] = if cfg!(target_os = "macos") {
        &[
            "Library/Application Support/Google/Chrome",
            "Library/Application Support/Chromium",
            "Library/Application Support/BraveSoftware/Brave-Browser",
            "Library/Application Support/Microsoft Edge",
        ]
    } else {
        &[
            ".config/google-chrome",
            ".config/chromium",
            ".config/BraveSoftware/Brave-Browser",
            ".config/microsoft-edge",
        ]
    };
    names.iter().map(|n| home.join(n)).collect()
}

/// Registra o host nos navegadores instalados. Roda a cada abertura do app,
/// para o caminho do executável acompanhar uma atualização ou mudança de pasta.
pub fn register() -> io::Result<()> {
    let exe = std::env::current_exe()?;
    let text = manifest(&exe.to_string_lossy());
    let file_name = format!("{HOST_NAME}.json");

    #[cfg(not(windows))]
    for dir in browser_dirs() {
        // Só onde o navegador existe; não cria pasta de navegador ausente.
        if dir.is_dir() {
            let hosts = dir.join("NativeMessagingHosts");
            fs::create_dir_all(&hosts)?;
            fs::write(hosts.join(&file_name), &text)?;
        }
    }

    #[cfg(windows)]
    {
        // No Windows o manifest fica na pasta de dados e o registro aponta para ele.
        let dir = data_dir().ok_or_else(|| io::Error::other("pasta de dados não encontrada"))?;
        fs::create_dir_all(&dir)?;
        let path = dir.join(&file_name);
        fs::write(&path, &text)?;
        for key in [
            "Software\\Google\\Chrome\\NativeMessagingHosts",
            "Software\\Chromium\\NativeMessagingHosts",
            "Software\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts",
            "Software\\Microsoft\\Edge\\NativeMessagingHosts",
        ] {
            let _ = std::process::Command::new("reg")
                .args([
                    "add",
                    &format!("HKCU\\{key}\\{HOST_NAME}"),
                    "/ve",
                    "/t",
                    "REG_SZ",
                    "/d",
                ])
                .arg(&path)
                .arg("/f")
                .output();
        }
    }
    Ok(())
}

// ---------------------------------------------------------------- host

fn read_message(input: &mut impl Read) -> io::Result<Option<Vec<u8>>> {
    let mut len = [0u8; 4];
    match input.read_exact(&mut len) {
        Ok(()) => {}
        Err(e) if e.kind() == io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(e) => return Err(e),
    }
    let len = u32::from_ne_bytes(len);
    if len > MAX_MESSAGE {
        return Err(io::Error::other("mensagem grande demais"));
    }
    let mut buf = vec![0u8; len as usize];
    input.read_exact(&mut buf)?;
    Ok(Some(buf))
}

fn write_message(output: &mut impl Write, msg: &[u8]) -> io::Result<()> {
    output.write_all(&(msg.len() as u32).to_ne_bytes())?;
    output.write_all(msg)?;
    output.flush()
}

fn connect_to_app() -> Option<TcpStream> {
    let text = fs::read_to_string(port_file()?).ok()?;
    let mut parts = text.split_whitespace();
    let port: u16 = parts.next()?.parse().ok()?;
    let token = parts.next()?;
    let mut stream = TcpStream::connect((Ipv4Addr::LOCALHOST, port)).ok()?;
    stream.write_all(format!("{token}\n").as_bytes()).ok()?;
    Some(stream)
}

/// Modo host: repassa mensagens até o navegador fechar a conexão. Com o app
/// fechado, espera ele abrir (a extensão mantém a conexão enquanto existir).
pub fn run_host() {
    let current: Arc<Mutex<Option<TcpStream>>> = Arc::default();
    let stdout = Arc::new(Mutex::new(io::stdout()));

    // App → navegador: conecta (e reconecta) e repassa cada linha.
    {
        let current = Arc::clone(&current);
        let stdout = Arc::clone(&stdout);
        thread::spawn(move || loop {
            let Some(stream) = connect_to_app() else {
                thread::sleep(Duration::from_secs(2));
                continue;
            };
            let Ok(reader) = stream.try_clone() else {
                continue;
            };
            *current.lock().unwrap() = Some(stream);
            for line in BufReader::new(reader).lines() {
                let Ok(line) = line else { break };
                if line.is_empty() {
                    continue;
                }
                if write_message(&mut *stdout.lock().unwrap(), line.as_bytes()).is_err() {
                    std::process::exit(0);
                }
            }
            *current.lock().unwrap() = None;
        });
    }

    // Navegador → app. Sem app aberto, a mensagem se perde: a extensão só
    // fala em resposta ao app, e o app reenvia "ola" ao conectar.
    let mut stdin = io::stdin();
    while let Ok(Some(msg)) = read_message(&mut stdin) {
        if let Some(stream) = current.lock().unwrap().as_mut() {
            let mut line = msg;
            line.retain(|b| *b != b'\n');
            line.push(b'\n');
            let _ = stream.write_all(&line);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mensagem_vai_e_volta_no_formato_do_navegador() {
        let mut buf = Vec::new();
        write_message(&mut buf, br#"{"type":"ola"}"#).unwrap();
        assert_eq!(&buf[..4], &14u32.to_ne_bytes());
        let mut cursor = io::Cursor::new(buf);
        assert_eq!(
            read_message(&mut cursor).unwrap().unwrap(),
            br#"{"type":"ola"}"#
        );
        assert!(read_message(&mut cursor).unwrap().is_none());
    }

    #[test]
    fn manifest_escapa_o_caminho_e_lista_a_extensao() {
        let m = manifest(r#"C:\Program Files\LattesEditor\app.exe"#);
        assert!(m.contains(r#""path": "C:\\Program Files\\LattesEditor\\app.exe""#));
        if DEV {
            assert!(m.contains("chrome-extension://alopgghbefjbmjomhgoebbjnmppokkgi/"));
            assert!(m.contains(r#""name": "lattes_editor.conector_dev""#));
        } else {
            assert!(m.contains("chrome-extension://elkaiefkldcngjdgelfjhjbljefbemac/"));
            assert!(m.contains(r#""name": "lattes_editor.conector""#));
        }
    }

    #[test]
    fn queda_de_ligacao_antiga_nao_desliga_a_nova() {
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).unwrap();
        let addr = listener.local_addr().unwrap();
        let _client = TcpStream::connect(addr).unwrap();
        let (stream, _) = listener.accept().unwrap();
        let conn = Mutex::new(Some((2, stream)));
        // A ligação 1 caiu depois que a 2 tomou o lugar: nada muda.
        assert!(!drop_if_current(&conn, 1));
        assert!(conn.lock().unwrap().is_some());
        // A atual caiu: desliga.
        assert!(drop_if_current(&conn, 2));
        assert!(conn.lock().unwrap().is_none());
    }

    #[test]
    fn ligacao_nova_fecha_a_antiga() {
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).unwrap();
        let addr = listener.local_addr().unwrap();
        let mut old_client = TcpStream::connect(addr).unwrap();
        let (old, _) = listener.accept().unwrap();
        let _new_client = TcpStream::connect(addr).unwrap();
        let (new, _) = listener.accept().unwrap();
        // A cópia que a thread de leitura da ligação antiga teria.
        let mut old_reader = old.try_clone().unwrap();
        let conn = Mutex::new(None);
        replace_current(&conn, 1, old);
        replace_current(&conn, 2, new);
        assert_eq!(conn.lock().unwrap().as_ref().map(|(id, _)| *id), Some(2));
        // A leitura da antiga termina, e o host antigo vê a ligação fechada.
        let mut buf = [0u8; 1];
        assert_eq!(old_reader.read(&mut buf).unwrap(), 0);
        old_client
            .set_read_timeout(Some(Duration::from_secs(5)))
            .unwrap();
        assert_eq!(old_client.read(&mut buf).unwrap(), 0);
    }

    #[test]
    fn segredo_tem_128_bits_e_muda() {
        let (a, b) = (secret(), secret());
        assert_eq!(a.len(), 32);
        assert_ne!(a, b);
    }
}
