//! A extensão do canal Dev, que viaja dentro do LattesEditor Dev. Ao abrir, o
//! app copia a extensão do pacote para uma pasta fixa da pasta de dados, e só
//! quando a versão muda. A pessoa carrega essa pasta uma vez no navegador
//! ("Carregar sem compactação"); depois, a extensão se recarrega sozinha quando
//! vê que o app mudou de versão (extension/src/background.ts), e lê os
//! arquivos novos da mesma pasta. Fora do canal Dev, nada disto roda.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

/// Pasta da extensão Dev dentro da pasta de dados do app.
const FOLDER: &str = "extensao-dev";

/// A version_name do manifest da extensão (0.22.0-dev.42), se houver.
pub fn installed_version(folder: &Path) -> Option<String> {
    let text = fs::read_to_string(folder.join("manifest.json")).ok()?;
    let manifest: serde_json::Value = serde_json::from_str(&text).ok()?;
    manifest
        .get("version_name")
        .or_else(|| manifest.get("version"))?
        .as_str()
        .map(str::to_owned)
}

fn copy_dir(from: &Path, to: &Path) -> io::Result<()> {
    fs::create_dir_all(to)?;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let target = to.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), target)?;
        }
    }
    Ok(())
}

/// Apaga uma pasta que sobrou de uma troca interrompida, se houver.
fn remove_leftover(dir: &Path) -> io::Result<()> {
    if dir.exists() {
        fs::remove_dir_all(dir)?;
    }
    Ok(())
}

/// Deixa `dest` com a extensão de `source`, se a versão for outra. Copia para
/// uma pasta ao lado (`.nova`) e troca no fim, para o navegador nunca ler uma
/// pasta pela metade. A troca são dois renames seguidos: a versão em uso vai
/// para `.velha`, a nova entra no lugar, e só então a velha é apagada. Assim a
/// pasta fica ausente só entre os dois renames, e não durante a cópia ou a
/// remoção. Se o segundo rename falhar, a versão em uso volta para o lugar.
pub fn sync_folder(source: &Path, dest: &Path, version: &str) -> io::Result<bool> {
    if installed_version(dest).as_deref() == Some(version) {
        return Ok(false);
    }
    let staging = dest.with_extension("nova");
    let old = dest.with_extension("velha");
    remove_leftover(&staging)?;
    remove_leftover(&old)?;
    copy_dir(source, &staging)?;
    let had_dest = dest.exists();
    if had_dest {
        fs::rename(dest, &old)?;
    }
    if let Err(e) = fs::rename(&staging, dest) {
        if had_dest {
            let _ = fs::rename(&old, dest);
        }
        return Err(e);
    }
    if had_dest {
        // A nova já está no lugar; uma velha que não saiu agora sai na próxima troca.
        let _ = fs::remove_dir_all(&old);
    }
    Ok(true)
}

/// A pasta da extensão Dev na pasta de dados do app.
pub fn folder(app: &AppHandle) -> Option<PathBuf> {
    Some(app.path().app_data_dir().ok()?.join(FOLDER))
}

/// Copia a extensão do pacote do app para a pasta de dados, se mudou.
pub fn sync(app: &AppHandle) -> io::Result<PathBuf> {
    let source = app
        .path()
        .resolve(FOLDER, BaseDirectory::Resource)
        .map_err(io::Error::other)?;
    let dest = folder(app).ok_or_else(|| io::Error::other("pasta de dados não encontrada"))?;
    sync_folder(&source, &dest, &app.package_info().version.to_string())?;
    Ok(dest)
}

/// Onde está a extensão Dev, para o editor dizer o que carregar no navegador.
/// Fora do canal Dev, nenhuma.
#[tauri::command]
pub fn extensao_dev_pasta(app: AppHandle) -> Option<String> {
    if !cfg!(feature = "canal-dev") {
        return None;
    }
    folder(&app).map(|p| p.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("lattes-ext-dev-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    fn write_extension(dir: &Path, version: &str, extra: &str) {
        fs::create_dir_all(dir.join("icons")).unwrap();
        fs::write(
            dir.join("manifest.json"),
            format!(r#"{{"version": "0.22.0.1", "version_name": "{version}"}}"#),
        )
        .unwrap();
        fs::write(dir.join("icons/a.txt"), extra).unwrap();
    }

    #[test]
    fn copia_quando_a_versao_muda_e_so_entao() {
        let source = temp("source");
        let dest = temp("dest");
        write_extension(&source, "0.22.0-dev.2", "nova");
        assert!(sync_folder(&source, &dest, "0.22.0-dev.2").unwrap());
        assert_eq!(installed_version(&dest).as_deref(), Some("0.22.0-dev.2"));
        assert_eq!(
            fs::read_to_string(dest.join("icons/a.txt")).unwrap(),
            "nova"
        );
        // Mesma versão: não mexe na pasta.
        fs::write(dest.join("icons/a.txt"), "mexida").unwrap();
        assert!(!sync_folder(&source, &dest, "0.22.0-dev.2").unwrap());
        assert_eq!(
            fs::read_to_string(dest.join("icons/a.txt")).unwrap(),
            "mexida"
        );
        // Versão nova: troca tudo, sem sobra da anterior.
        fs::write(dest.join("velho.txt"), "sobra").unwrap();
        write_extension(&source, "0.22.0-dev.3", "mais nova");
        assert!(sync_folder(&source, &dest, "0.22.0-dev.3").unwrap());
        assert!(!dest.join("velho.txt").exists());
        assert!(!dest.with_extension("nova").exists());
        assert!(!dest.with_extension("velha").exists());
        let _ = fs::remove_dir_all(&source);
        let _ = fs::remove_dir_all(&dest);
    }

    #[test]
    fn sobras_de_troca_interrompida_nao_atrapalham() {
        let source = temp("source-sobra");
        let dest = temp("dest-sobra");
        write_extension(&source, "0.22.0-dev.5", "nova");
        write_extension(&dest, "0.22.0-dev.4", "em uso");
        // Uma troca anterior parou no meio e deixou as duas pastas ao lado.
        fs::create_dir_all(dest.with_extension("nova")).unwrap();
        fs::write(dest.with_extension("nova").join("lixo.txt"), "x").unwrap();
        fs::create_dir_all(dest.with_extension("velha")).unwrap();
        assert!(sync_folder(&source, &dest, "0.22.0-dev.5").unwrap());
        assert_eq!(installed_version(&dest).as_deref(), Some("0.22.0-dev.5"));
        assert!(!dest.join("lixo.txt").exists());
        assert!(!dest.with_extension("nova").exists());
        assert!(!dest.with_extension("velha").exists());
        let _ = fs::remove_dir_all(&source);
        let _ = fs::remove_dir_all(&dest);
    }

    #[test]
    fn sem_manifest_nao_tem_versao() {
        assert_eq!(installed_version(&temp("vazia")), None);
    }
}
