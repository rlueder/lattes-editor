//! App de desktop do LattesEditor: a mesma página do editor num webview do
//! sistema, com diálogos nativos de abrir e salvar, e a chave que cifra os
//! dados locais no chaveiro do sistema (chave.rs). As cópias de segurança do
//! currículo vão para uma pasta visível, em Documentos (copias.rs).
//!
//! O app nunca abre o Lattes por conta própria: as alterações vão para o
//! Lattes pela extensão do navegador (decisão de 11/10/2026, ver
//! docs/arquitetura.md). A fila vai à extensão por mensagens nativas
//! (ver conector.rs).

mod chave;
mod conector;
mod copias;
mod extensao_dev;

use std::fs;

use tauri::Manager;

/// Lê o arquivo escolhido no diálogo nativo e devolve os bytes como vieram
/// (o XML do Lattes é Latin-1; a decodificação fica com o editor).
#[tauri::command]
fn read_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|e| format!("Não deu para ler {path}: {e}"))
}

/// Grava os bytes exatamente como o editor os produziu (Latin-1 no XML).
#[tauri::command]
fn write_file(path: String, bytes: Vec<u8>) -> Result<(), String> {
    fs::write(&path, bytes).map_err(|e| format!("Não deu para gravar {path}: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Chamado pelo navegador como host nativo: só repassa mensagens, sem janela.
    if conector::is_host_invocation() {
        conector::run_host();
        return;
    }
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(conector::Conector::default())
        .setup(|app| {
            debug_assert_eq!(app.config().identifier, conector::IDENTIFIER);
            // Falha aqui não impede o editor: só fica sem conector, e o painel avisa.
            if let Err(e) = conector::register() {
                eprintln!("conector: registro do host falhou: {e}");
            }
            // Canal Dev: a extensão que veio no pacote vai para a pasta que o
            // navegador carrega, antes de a extensão se ligar ao app.
            if cfg!(feature = "canal-dev") {
                if let Err(e) = extensao_dev::sync(app.handle()) {
                    eprintln!("extensão Dev: cópia falhou: {e}");
                }
            }
            if let Err(e) = conector::start(app.handle(), &app.state::<conector::Conector>()) {
                eprintln!("conector: porta local falhou: {e}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            conector::conector_send,
            chave::storage_key_get,
            chave::storage_key_set,
            copias::backup_folder,
            copias::backup_list,
            copias::backup_read,
            copias::backup_reveal,
            copias::backup_save_baseline,
            copias::backup_save_restore_point,
            extensao_dev::extensao_dev_pasta
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o app");
}
