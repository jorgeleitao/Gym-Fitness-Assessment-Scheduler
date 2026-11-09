//! Processo da API (node + main.cjs) que acompanha a janela do app.

use std::io::{BufRead, BufReader};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager};

pub struct Servidor {
    processo: Child,
    porta: u16,
}

fn erro(mensagem: String) -> Box<dyn std::error::Error> {
    mensagem.into()
}

/// Pede uma porta livre ao sistema.
fn porta_livre() -> std::io::Result<u16> {
    Ok(TcpListener::bind("127.0.0.1:0")?.local_addr()?.port())
}

impl Servidor {
    pub fn iniciar(app: &AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        let recursos = app.path().resource_dir()?;
        let dados = app.path().app_config_dir()?;
        let node = node_empacotado()?;
        let porta = porta_livre()?;

        let mut comando = Command::new(&node);
        comando
            .arg(recursos.join("api").join("main.cjs"))
            .env("PORTA", porta.to_string())
            .env("HOST", "127.0.0.1")
            .env("DADOS_DIR", &dados)
            .env("WEB_DIR", recursos.join("web"))
            .env("CLIENTE_DIR", recursos.join("cliente"))
            .env("CLIENTE", env!("PAINEL_CLIENTE"))
            .env("NODE_NO_WARNINGS", "1")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped());

        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            comando.creation_flags(CREATE_NO_WINDOW);
        }

        let mut processo = comando
            .spawn()
            .map_err(|e| erro(format!("Não foi possível iniciar o servidor ({}): {e}", node.display())))?;

        let endereco = SocketAddr::from(([127, 0, 0, 1], porta));
        let limite = Instant::now() + Duration::from_secs(20);
        while TcpStream::connect_timeout(&endereco, Duration::from_millis(200)).is_err() {
            if let Some(status) = processo.try_wait()? {
                let mut saida = String::new();
                if let Some(stderr) = processo.stderr.take() {
                    for linha in BufReader::new(stderr).lines().map_while(Result::ok).take(20) {
                        saida.push_str(&linha);
                        saida.push('\n');
                    }
                }
                return Err(erro(format!("O servidor parou ({status}):\n{saida}")));
            }
            if Instant::now() > limite {
                let _ = processo.kill();
                return Err(erro("O servidor demorou demais para iniciar.".into()));
            }
            std::thread::sleep(Duration::from_millis(100));
        }
        Ok(Self { processo, porta })
    }

    pub fn url(&self) -> Result<url::Url, url::ParseError> {
        format!("http://127.0.0.1:{}/", self.porta).parse()
    }

    pub fn parar(mut self) {
        let _ = self.processo.kill();
        let _ = self.processo.wait();
    }
}

/// node.exe copiado para junto do executável (sidecar "painel-node" do tauri.conf.json).
fn node_empacotado() -> Result<PathBuf, Box<dyn std::error::Error>> {
    let pasta = std::env::current_exe()?
        .parent()
        .map(PathBuf::from)
        .ok_or_else(|| erro("pasta do executável não encontrada".into()))?;
    let nome = if cfg!(windows) { "painel-node.exe" } else { "painel-node" };
    let caminho = pasta.join(nome);
    if caminho.exists() {
        Ok(caminho)
    } else {
        Err(erro(format!("{} não encontrado.", caminho.display())))
    }
}
