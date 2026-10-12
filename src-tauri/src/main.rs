// Evita uma janela de console a mais no Windows em release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// O binário se chama LattesEditor, como o app.
#![allow(non_snake_case)]

fn main() {
    lattes_editor_lib::run()
}
