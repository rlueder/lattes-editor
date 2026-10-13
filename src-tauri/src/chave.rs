//! Chave que cifra o que o editor guarda no disco (cópia de trabalho,
//! histórico e registro do que foi enviado ao Lattes).
//!
//! A chave fica no chaveiro do sistema: Keychain no macOS, Credential
//! Manager no Windows, Secret Service (GNOME Keyring, KWallet) no Linux. Quem
//! gera a chave é o editor, com o gerador do WebCrypto; aqui só se lê e grava
//! a entrada. O valor nunca vai para log nem para mensagem de erro.

use keyring::Entry;
use tauri::AppHandle;

/// Conta da entrada no chaveiro. O app de desenvolvimento usa outra, para
/// nunca ler nem sobrescrever a chave do app instalado.
const ACCOUNT: &str = if cfg!(debug_assertions) {
    "chave-dos-dados-desenvolvimento"
} else {
    "chave-dos-dados"
};

/// 32 bytes em base64 (com preenchimento): 44 caracteres.
fn is_valid_key(key: &str) -> bool {
    key.len() == 44
        && key.ends_with('=')
        && key[..43]
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'+' || b == b'/')
}

fn entry(app: &AppHandle) -> Result<Entry, String> {
    Entry::new(&app.config().identifier, ACCOUNT).map_err(|e| unavailable(&e))
}

fn unavailable(e: &keyring::Error) -> String {
    format!("O chaveiro do sistema não respondeu: {e}")
}

/// O chaveiro bloqueia (no Linux, o Secret Service pode pedir a senha e
/// esperar a pessoa): roda fora da thread principal, para a janela não travar.
async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|e| format!("O chaveiro do sistema não respondeu: {e}"))?
}

/// A chave guardada, ou None se ainda não existe (primeiro uso, ou chaveiro
/// apagado). Erro quando o chaveiro não está disponível.
#[tauri::command]
pub async fn storage_key_get(app: AppHandle) -> Result<Option<String>, String> {
    blocking(move || match entry(&app)?.get_password() {
        Ok(key) if is_valid_key(&key) => Ok(Some(key)),
        Ok(_) => Err("A chave guardada no chaveiro está num formato inesperado.".into()),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(unavailable(&e)),
    })
    .await
}

/// Grava a chave gerada pelo editor. Recusa se já existir uma, para que uma
/// chamada repetida nunca troque a chave dos dados já cifrados.
#[tauri::command]
pub async fn storage_key_set(app: AppHandle, key: String) -> Result<(), String> {
    if !is_valid_key(&key) {
        return Err("Chave em formato inválido.".into());
    }
    blocking(move || {
        let entry = entry(&app)?;
        match entry.get_password() {
            Ok(_) => Err("Já existe uma chave no chaveiro.".into()),
            Err(keyring::Error::NoEntry) => entry.set_password(&key).map_err(|e| unavailable(&e)),
            Err(e) => Err(unavailable(&e)),
        }
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::is_valid_key;

    #[test]
    fn accepts_only_32_bytes_in_base64() {
        assert!(is_valid_key("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="));
        assert!(is_valid_key("abc+/0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZab="));
        assert!(!is_valid_key("AAAA"));
        assert!(!is_valid_key(
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        ));
        assert!(!is_valid_key(
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA!="
        ));
    }
}
