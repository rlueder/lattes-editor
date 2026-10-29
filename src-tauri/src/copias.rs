//! Cópias de segurança do currículo (LAT-59), numa pasta visível da pessoa:
//! `Documentos/LattesEditor/Cópias de segurança/<NUMERO-IDENTIFICADOR>/`.
//!
//! Ficam ali, fora do armazenamento interno do app e sem cifra, os arquivos
//! que o Lattes entregou, byte a byte: o ponto zero (a primeira exportação de
//! cada currículo) e um ponto de restauração antes de cada rodada de escrita
//! do conector. Cada arquivo vem com um `.json` ao lado (data, origem e o
//! SHA-256), montado pelo editor.
//!
//! Tudo aqui só cria ou lê. Cada arquivo nasce com `create_new`, que falha se
//! o nome já existe, e nada neste módulo abre um arquivo para escrita sem ele,
//! renomeia ou apaga. A pasta é da pessoa: o app não tem caminho para mexer
//! no que já está lá. Ler serve ao "Restaurar" do ponto zero no histórico.

use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::UNIX_EPOCH;

use serde_json::Value;
use tauri::http::HeaderMap;
use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, Manager};

/// A pasta dentro de Documentos.
const APP_FOLDER: &str = "LattesEditor";
const BACKUP_FOLDER: &str = "Cópias de segurança";
/// Prefixo do ponto zero: um por currículo, qualquer que seja a data.
const BASELINE_PREFIX: &str = "ponto-zero-";
const RESTORE_PREFIX: &str = "restauracao-";
/// O sidecar é um JSON pequeno; mais que isso não é o que o editor manda.
const SIDECAR_LIMIT: usize = 64 * 1024;
/// Restaurações no mesmo minuto ganham -2, -3…; além disso, algo está errado.
const SAME_MINUTE_LIMIT: u32 = 99;

/// O ponto zero é "conferir e criar": a trava impede que duas gravações ao
/// mesmo tempo vejam a pasta vazia e criem dois.
static WRITING: Mutex<()> = Mutex::new(());

/// Documentos da pessoa (no macOS, `~/Documents`, que o Finder mostra como
/// "Documentos"; no Windows, a pasta Documentos; no Linux, a `XDG_DOCUMENTS_DIR`).
/// Sem ela, a pasta pessoal.
fn root(app: &AppHandle) -> Result<PathBuf, String> {
    let paths = app.path();
    let base = paths
        .document_dir()
        .or_else(|_| paths.home_dir())
        .map_err(|e| format!("Não achei a pasta Documentos: {e}"))?;
    Ok(base.join(APP_FOLDER).join(BACKUP_FOLDER))
}

/// O NUMERO-IDENTIFICADOR tem 16 dígitos; aceitar só dígitos impede que o
/// nome da pasta saia de `Cópias de segurança`.
fn cv_dir(root: &Path, lattes_id: &str) -> Result<PathBuf, String> {
    let ok = !lattes_id.is_empty()
        && lattes_id.len() <= 32
        && lattes_id.bytes().all(|b| b.is_ascii_digit());
    if !ok {
        return Err("Identificador do currículo inválido.".into());
    }
    Ok(root.join(lattes_id))
}

/// `AAAA-MM-DD` (ponto zero) ou `AAAA-MM-DD-HHMM` (restauração), só dígitos e hífens.
fn valid_stamp(stamp: &str, with_time: bool) -> bool {
    let shape: &[usize] = if with_time { &[4, 2, 2, 4] } else { &[4, 2, 2] };
    let parts: Vec<&str> = stamp.split('-').collect();
    parts.len() == shape.len()
        && parts
            .iter()
            .zip(shape)
            .all(|(p, n)| p.len() == *n && p.bytes().all(|b| b.is_ascii_digit()))
}

/// Cria o arquivo e grava; se o nome já existe, falha com `AlreadyExists` e
/// não toca no que está lá. Nunca trunca.
fn create_new(path: &Path, bytes: &[u8]) -> io::Result<()> {
    let mut file = OpenOptions::new().write(true).create_new(true).open(path)?;
    file.write_all(bytes)?;
    file.sync_all()
}

fn has_baseline(dir: &Path) -> io::Result<bool> {
    match fs::read_dir(dir) {
        Ok(entries) => Ok(entries
            .filter_map(Result::ok)
            .any(|e| e.file_name().to_string_lossy().starts_with(BASELINE_PREFIX))),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(e) => Err(e),
    }
}

fn io_message(e: &io::Error) -> String {
    format!("Não deu para gravar a cópia de segurança: {e}")
}

/// O sidecar como fica no disco: o JSON que o editor mandou, citando o nome
/// final do arquivo, legível por quem abrir a pasta.
fn sidecar_text(sidecar: &Value, name: &str) -> String {
    let mut value = sidecar.clone();
    value["arquivo"] = Value::String(name.to_owned());
    let mut text = serde_json::to_string_pretty(&value).unwrap_or_default();
    text.push('\n');
    text
}

/// Grava o ponto zero do currículo, se ainda não houver um. Devolve o nome
/// do arquivo criado, ou None quando já existia um ponto zero (de qualquer
/// data): esse fica como está.
pub fn write_baseline(
    root: &Path,
    lattes_id: &str,
    stamp: &str,
    bytes: &[u8],
    sidecar: &Value,
) -> Result<Option<String>, String> {
    if !valid_stamp(stamp, false) {
        return Err("Pedido de cópia de segurança inválido.".into());
    }
    let dir = cv_dir(root, lattes_id)?;
    let _guard = WRITING.lock().unwrap_or_else(|e| e.into_inner());
    if has_baseline(&dir).map_err(|e| io_message(&e))? {
        return Ok(None);
    }
    fs::create_dir_all(&dir).map_err(|e| io_message(&e))?;
    let name = format!("{BASELINE_PREFIX}{stamp}.zip");
    match create_new(&dir.join(&name), bytes) {
        Ok(()) => {}
        Err(e) if e.kind() == io::ErrorKind::AlreadyExists => return Ok(None),
        Err(e) => return Err(io_message(&e)),
    }
    // O sidecar é auxiliar: se já houver um com o nome, o que está lá fica.
    let _ = create_new(
        &dir.join(format!("{BASELINE_PREFIX}{stamp}.json")),
        sidecar_text(sidecar, &name).as_bytes(),
    );
    Ok(Some(name))
}

/// Grava um ponto de restauração. O nome leva data e hora; no mesmo minuto,
/// ganha `-2`, `-3`…, e nunca substitui um arquivo existente.
pub fn write_restore_point(
    root: &Path,
    lattes_id: &str,
    stamp: &str,
    bytes: &[u8],
    sidecar: &Value,
) -> Result<String, String> {
    if !valid_stamp(stamp, true) {
        return Err("Pedido de cópia de segurança inválido.".into());
    }
    let dir = cv_dir(root, lattes_id)?;
    let _guard = WRITING.lock().unwrap_or_else(|e| e.into_inner());
    fs::create_dir_all(&dir).map_err(|e| io_message(&e))?;
    for n in 1..=SAME_MINUTE_LIMIT {
        let base = if n == 1 {
            format!("{RESTORE_PREFIX}{stamp}")
        } else {
            format!("{RESTORE_PREFIX}{stamp}-{n}")
        };
        let name = format!("{base}.zip");
        match create_new(&dir.join(&name), bytes) {
            Ok(()) => {
                let text = sidecar_text(sidecar, &name);
                let _ = create_new(&dir.join(format!("{base}.json")), text.as_bytes());
                return Ok(name);
            }
            Err(e) if e.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(io_message(&e)),
        }
    }
    Err("Restaurações demais no mesmo minuto.".into())
}

/// Cabeçalhos do pedido de gravação; o arquivo vem no corpo, em binário.
const HEADER_ID: &str = "x-lattes-id";
const HEADER_STAMP: &str = "x-stamp";
const HEADER_SIDECAR: &str = "x-sidecar";

/// Um pedido de gravação já lido: o ZIP como veio e o resto dos cabeçalhos.
#[derive(Debug)]
pub struct Upload {
    bytes: Vec<u8>,
    lattes_id: String,
    sidecar: Value,
    stamp: String,
}

/// Lê o pedido do editor. O ZIP vem no corpo cru (`InvokeBody::Raw`, um
/// `Uint8Array` no `invoke`), sem passar por JSON; o identificador, a data e
/// o sidecar (JSON numa linha, só ASCII) vêm nos cabeçalhos.
pub fn parse_upload(body: &InvokeBody, headers: &HeaderMap) -> Result<Upload, String> {
    let InvokeBody::Raw(bytes) = body else {
        return Err("O arquivo da cópia não veio em binário.".into());
    };
    let header = |name: &str| {
        headers
            .get(name)
            .and_then(|v| v.to_str().ok())
            .map(str::to_owned)
            .ok_or_else(|| format!("Pedido de cópia de segurança sem {name}."))
    };
    let sidecar_raw = header(HEADER_SIDECAR)?;
    if sidecar_raw.len() > SIDECAR_LIMIT {
        return Err("Pedido de cópia de segurança inválido.".into());
    }
    let sidecar: Value = serde_json::from_str(&sidecar_raw)
        .ok()
        .filter(Value::is_object)
        .ok_or("O sidecar da cópia não é um objeto JSON.")?;
    Ok(Upload {
        bytes: bytes.clone(),
        lattes_id: header(HEADER_ID)?,
        sidecar,
        stamp: header(HEADER_STAMP)?,
    })
}

#[derive(Debug, PartialEq)]
pub struct BackupEntry {
    name: String,
    size: u64,
    /// Última modificação, em ms desde 1970 (0 se o sistema não diz).
    modified_at: u64,
}

impl BackupEntry {
    fn to_json(&self) -> serde_json::Value {
        serde_json::json!({ "modifiedAt": self.modified_at, "name": self.name, "size": self.size })
    }
}

/// Os arquivos da pasta do currículo (só os do app, sem os sidecars), pelo nome.
pub fn list(root: &Path, lattes_id: &str) -> Result<Vec<BackupEntry>, String> {
    let dir = cv_dir(root, lattes_id)?;
    let entries = match fs::read_dir(&dir) {
        Ok(entries) => entries,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(format!("Não deu para ler a pasta das cópias: {e}")),
    };
    let mut out: Vec<BackupEntry> = entries
        .filter_map(Result::ok)
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().into_owned();
            let ours = name.starts_with(BASELINE_PREFIX) || name.starts_with(RESTORE_PREFIX);
            if !ours || name.ends_with(".json") {
                return None;
            }
            let meta = e.metadata().ok()?;
            if !meta.is_file() {
                return None;
            }
            let modified_at = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map_or(0, |d| d.as_millis() as u64);
            Some(BackupEntry {
                name,
                size: meta.len(),
                modified_at,
            })
        })
        .collect();
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

/// O caminho de um arquivo da pasta, só se o nome for um nome simples.
fn entry_path(root: &Path, lattes_id: &str, name: &str) -> Result<PathBuf, String> {
    let simple = !name.is_empty()
        && !name.contains(['/', '\\'])
        && name != "."
        && name != ".."
        && (name.starts_with(BASELINE_PREFIX) || name.starts_with(RESTORE_PREFIX));
    if !simple {
        return Err("Nome de arquivo inválido.".into());
    }
    Ok(cv_dir(root, lattes_id)?.join(name))
}

/// O maior arquivo que "Restaurar" lê: uma exportação do Lattes tem centenas
/// de kB; muito mais que isso não é uma cópia que o app guardou.
const READ_LIMIT: u64 = 64 * 1024 * 1024;

/// Os bytes de uma cópia (não do sidecar), pelo nome que `list` deu.
pub fn read_entry(root: &Path, lattes_id: &str, name: &str) -> Result<Vec<u8>, String> {
    if name.ends_with(".json") {
        return Err("Nome de arquivo inválido.".into());
    }
    let path = entry_path(root, lattes_id, name)?;
    let size = fs::metadata(&path).map_err(|e| io_message(&e))?.len();
    if size > READ_LIMIT {
        return Err("A cópia é grande demais para abrir.".into());
    }
    fs::read(&path).map_err(|e| io_message(&e))
}

async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|e| format!("A gravação da cópia não terminou: {e}"))?
}

/// A pasta das cópias deste currículo (pode ainda não existir).
#[tauri::command]
pub fn backup_folder(app: AppHandle, lattes_id: String) -> Result<String, String> {
    Ok(cv_dir(&root(&app)?, &lattes_id)?
        .to_string_lossy()
        .into_owned())
}

#[tauri::command]
pub fn backup_list(app: AppHandle, lattes_id: String) -> Result<Vec<serde_json::Value>, String> {
    Ok(list(&root(&app)?, &lattes_id)?
        .iter()
        .map(BackupEntry::to_json)
        .collect())
}

#[tauri::command]
pub async fn backup_save_baseline(
    app: AppHandle,
    request: Request<'_>,
) -> Result<Option<String>, String> {
    let root = root(&app)?;
    let up = parse_upload(request.body(), request.headers())?;
    blocking(move || write_baseline(&root, &up.lattes_id, &up.stamp, &up.bytes, &up.sidecar)).await
}

#[tauri::command]
pub async fn backup_save_restore_point(
    app: AppHandle,
    request: Request<'_>,
) -> Result<String, String> {
    let root = root(&app)?;
    let up = parse_upload(request.body(), request.headers())?;
    blocking(move || write_restore_point(&root, &up.lattes_id, &up.stamp, &up.bytes, &up.sidecar))
        .await
}

/// "Mostrar na pasta": o arquivo no Finder, no Explorer ou no gerenciador de
/// arquivos; sem nome, a pasta do currículo (criada se ainda não existir).
#[tauri::command]
pub fn backup_reveal(
    app: AppHandle,
    lattes_id: String,
    name: Option<String>,
) -> Result<(), String> {
    let root = root(&app)?;
    let path = match name {
        Some(name) => entry_path(&root, &lattes_id, &name)?,
        None => {
            let dir = cv_dir(&root, &lattes_id)?;
            fs::create_dir_all(&dir).map_err(|e| io_message(&e))?;
            dir
        }
    };
    tauri_plugin_opener::reveal_item_in_dir(path)
        .map_err(|e| format!("Não deu para abrir a pasta: {e}"))
}

/// Os bytes de uma cópia deste currículo, crus no corpo da resposta.
#[tauri::command]
pub async fn backup_read(
    app: AppHandle,
    lattes_id: String,
    name: String,
) -> Result<tauri::ipc::Response, String> {
    let root = root(&app)?;
    let bytes = blocking(move || read_entry(&root, &lattes_id, &name)).await?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri::http::HeaderValue;

    fn temp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("lattes-copias-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    const ID: &str = "1234567890123456";

    fn sidecar() -> Value {
        serde_json::json!({ "arquivo": "x", "origem": "conector", "tipo": "ponto-zero" })
    }

    fn sidecar_on_disk(path: &Path) -> Value {
        serde_json::from_slice(&fs::read(path).unwrap()).unwrap()
    }

    #[test]
    fn ponto_zero_nunca_e_sobrescrito() {
        let root = temp("ponto-zero");
        let first = write_baseline(&root, ID, "2026-10-15", b"PK primeiro", &sidecar()).unwrap();
        assert_eq!(first.as_deref(), Some("ponto-zero-2026-10-15.zip"));
        // O mesmo dia e outro dia: nada é gravado, e o primeiro fica intacto.
        assert_eq!(
            write_baseline(&root, ID, "2026-10-15", b"PK segundo", &sidecar()).unwrap(),
            None
        );
        assert_eq!(
            write_baseline(&root, ID, "2026-11-01", b"PK outro", &sidecar()).unwrap(),
            None
        );
        let dir = root.join(ID);
        assert_eq!(
            fs::read(dir.join("ponto-zero-2026-10-15.zip")).unwrap(),
            b"PK primeiro"
        );
        let json = sidecar_on_disk(&dir.join("ponto-zero-2026-10-15.json"));
        assert_eq!(json["arquivo"], "ponto-zero-2026-10-15.zip");
        assert_eq!(json["origem"], "conector");
        assert!(!dir.join("ponto-zero-2026-11-01.zip").exists());
        // Outro currículo tem o seu.
        assert!(write_baseline(&root, "99", "2026-10-15", b"PK", &sidecar())
            .unwrap()
            .is_some());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn create_new_recusa_arquivo_existente_sem_truncar() {
        let root = temp("create-new");
        fs::create_dir_all(&root).unwrap();
        let path = root.join("a.zip");
        create_new(&path, b"original").unwrap();
        let err = create_new(&path, b"x").unwrap_err();
        assert_eq!(err.kind(), io::ErrorKind::AlreadyExists);
        assert_eq!(fs::read(&path).unwrap(), b"original");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn restauracao_no_mesmo_minuto_ganha_outro_nome() {
        let root = temp("restauracao");
        let a = write_restore_point(&root, ID, "2026-10-15-1432", b"PK a", &sidecar()).unwrap();
        let b = write_restore_point(&root, ID, "2026-10-15-1432", b"PK b", &sidecar()).unwrap();
        assert_eq!(a, "restauracao-2026-10-15-1432.zip");
        assert_eq!(b, "restauracao-2026-10-15-1432-2.zip");
        let dir = root.join(ID);
        assert_eq!(fs::read(dir.join(&a)).unwrap(), b"PK a");
        assert_eq!(fs::read(dir.join(&b)).unwrap(), b"PK b");
        // Cada sidecar cita o próprio arquivo.
        assert_eq!(
            sidecar_on_disk(&dir.join("restauracao-2026-10-15-1432.json"))["arquivo"],
            a.as_str()
        );
        assert_eq!(
            sidecar_on_disk(&dir.join("restauracao-2026-10-15-1432-2.json"))["arquivo"],
            b.as_str()
        );
        let names: Vec<String> = list(&root, ID)
            .unwrap()
            .into_iter()
            .map(|e| e.name)
            .collect();
        assert_eq!(names.len(), 2);
        assert!(names.contains(&a) && names.contains(&b));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn recusa_identificador_data_e_nome_que_sairiam_da_pasta() {
        let root = temp("validacao");
        assert!(write_baseline(&root, "../x", "2026-10-15", b"PK", &sidecar()).is_err());
        assert!(write_baseline(&root, ID, "2026/10/15", b"PK", &sidecar()).is_err());
        assert!(write_restore_point(&root, ID, "2026-10-15", b"PK", &sidecar()).is_err());
        assert!(write_restore_point(&root, "", "2026-10-15-1432", b"PK", &sidecar()).is_err());
        assert!(entry_path(&root, ID, "../ponto-zero-x.zip").is_err());
        assert!(entry_path(&root, ID, "outro.zip").is_err());
        assert!(entry_path(&root, ID, "ponto-zero-2026-10-15.zip").is_ok());
        assert!(!root.exists());
    }

    #[test]
    fn le_so_a_copia_pelo_nome_da_lista() {
        let root = temp("leitura");
        write_baseline(&root, ID, "2026-10-15", b"PK", &sidecar()).unwrap();
        assert_eq!(read_entry(&root, ID, "ponto-zero-2026-10-15.zip").unwrap(), b"PK");
        assert!(read_entry(&root, ID, "ponto-zero-2026-10-15.json").is_err());
        assert!(read_entry(&root, ID, "../ponto-zero-2026-10-15.zip").is_err());
        assert!(read_entry(&root, "../x", "ponto-zero-2026-10-15.zip").is_err());
        assert!(read_entry(&root, ID, "ponto-zero-1999-01-01.zip").is_err());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn lista_vazia_sem_pasta_e_sem_os_sidecars() {
        let root = temp("lista");
        assert!(list(&root, ID).unwrap().is_empty());
        write_baseline(&root, ID, "2026-10-15", b"PK", &sidecar()).unwrap();
        fs::write(root.join(ID).join("anotacao.txt"), b"da pessoa").unwrap();
        let entries = list(&root, ID).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "ponto-zero-2026-10-15.zip");
        assert_eq!(entries[0].size, 2);
        let _ = fs::remove_dir_all(&root);
    }

    fn headers(pairs: &[(&'static str, &str)]) -> HeaderMap {
        let mut map = HeaderMap::new();
        for (name, value) in pairs {
            map.insert(*name, HeaderValue::from_str(value).unwrap());
        }
        map
    }

    #[test]
    fn pedido_em_binario_com_os_cabecalhos() {
        let zip = vec![0x50, 0x4b, 3, 4, 0xff, 0];
        let full = headers(&[
            (HEADER_ID, ID),
            (HEADER_STAMP, "2026-10-15"),
            (
                HEADER_SIDECAR,
                r#"{"origem":"conector","tipo":"ponto-zero"}"#,
            ),
        ]);
        let up = parse_upload(&InvokeBody::Raw(zip.clone()), &full).unwrap();
        assert_eq!(up.bytes, zip);
        assert_eq!(up.lattes_id, ID);
        assert_eq!(up.stamp, "2026-10-15");
        assert_eq!(up.sidecar["origem"], "conector");

        // Bytes como JSON (o caminho antigo, número a número) não valem.
        let json = InvokeBody::Json(serde_json::json!([0x50, 0x4b]));
        assert!(parse_upload(&json, &full).is_err());
        // Sem cabeçalho, ou sidecar que não é objeto JSON.
        let missing = headers(&[(HEADER_ID, ID), (HEADER_SIDECAR, "{}")]);
        assert!(parse_upload(&InvokeBody::Raw(zip.clone()), &missing).is_err());
        let not_object = headers(&[
            (HEADER_ID, ID),
            (HEADER_STAMP, "2026-10-15"),
            (HEADER_SIDECAR, "[1]"),
        ]);
        assert!(parse_upload(&InvokeBody::Raw(zip.clone()), &not_object).is_err());
        let huge = "x".repeat(SIDECAR_LIMIT + 1);
        let too_big = headers(&[
            (HEADER_ID, ID),
            (HEADER_STAMP, "2026-10-15"),
            (HEADER_SIDECAR, &huge),
        ]);
        assert!(parse_upload(&InvokeBody::Raw(zip), &too_big).is_err());
    }
}
