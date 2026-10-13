//! App de desktop do LattesEditor: a mesma página do editor num webview do
//! sistema, com diálogos nativos de abrir e salvar, e a chave que cifra os
//! dados locais no chaveiro do sistema (chave.rs).
//!
//! O app nunca abre o Lattes por conta própria: as alterações vão para o
//! Lattes pela extensão do navegador (ver docs/lattes_product_requirements.md,
//! "Atualização de 11/10/2026"). A fila vai à extensão por mensagens nativas
//! (ver ponte.rs).

mod chave;
mod ponte;

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
    if ponte::is_host_invocation() {
        ponte::run_host();
        return;
    }
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(ponte::Ponte::default())
        .setup(|app| {
            debug_assert_eq!(app.config().identifier, ponte::IDENTIFIER);
            // Falha aqui não impede o editor: só fica sem ponte, e o painel avisa.
            if let Err(e) = ponte::register() {
                eprintln!("ponte: registro do host falhou: {e}");
            }
            if let Err(e) = ponte::start(app.handle(), &app.state::<ponte::Ponte>()) {
                eprintln!("ponte: porta local falhou: {e}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            ponte::ponte_send,
            chave::storage_key_get,
            chave::storage_key_set
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o app");
}
