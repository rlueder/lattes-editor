// Evita uma janela de console a mais no Windows em release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    lattes_editor_lib::run()
}
