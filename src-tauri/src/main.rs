// Evita abrir uma janela de console junto com o aplicativo no Windows (release).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    painel_lib::run()
}
