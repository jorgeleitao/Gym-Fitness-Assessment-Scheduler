//! Versão desktop: inicia a API NestJS (Node empacotado junto do app) numa porta
//! livre de 127.0.0.1 e abre a interface Angular servida por ela numa janela.

mod servidor;

use std::sync::Mutex;

use tauri::webview::{DownloadEvent, NewWindowResponse};
use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

use servidor::Servidor;

const TITULO: &str = env!("PAINEL_TITULO");

fn abrir_janela(app: &tauri::AppHandle, url: url::Url) -> tauri::Result<()> {
    let origem = url.origin();
    let abridor = app.clone();
    let pasta_downloads = app.path().download_dir().ok();

    WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
        .title(TITULO)
        .inner_size(1280.0, 820.0)
        .min_inner_size(900.0, 600.0)
        .center()
        .maximized(true)
        // A janela só navega dentro do próprio servidor local.
        .on_navigation(move |destino| destino.origin() == origem)
        // "Enviar lembrete" abre o WhatsApp no navegador padrão; qualquer outro link é bloqueado.
        .on_new_window(move |destino, _| {
            if destino.scheme() == "https" && destino.host_str() == Some("wa.me") {
                let _ = abridor.opener().open_url(destino.as_str(), None::<&str>);
            }
            NewWindowResponse::Deny
        })
        // Backups baixados vão para a pasta Downloads do usuário.
        .on_download(move |_, evento| {
            if let DownloadEvent::Requested { destination, .. } = evento {
                if let (Some(pasta), Some(nome)) = (&pasta_downloads, destination.file_name()) {
                    *destination = pasta.join(nome);
                }
            }
            true
        })
        .build()?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let servidor = Servidor::iniciar(app.handle())?;
            let url = servidor.url()?;
            app.manage(Mutex::new(Some(servidor)));
            abrir_janela(app.handle(), url)?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect(concat!("erro ao iniciar o ", env!("PAINEL_TITULO")))
        .run(|app, evento| {
            if let RunEvent::Exit = evento {
                if let Some(estado) = app.try_state::<Mutex<Option<Servidor>>>() {
                    if let Some(servidor) = estado.lock().ok().and_then(|mut s| s.take()) {
                        servidor.parar();
                    }
                }
            }
        });
}
