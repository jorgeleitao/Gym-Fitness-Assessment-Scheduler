//! Lê clientes/<CLIENTE>/cliente.json para o título da janela e repassa o id do cliente.
//! A validação completa do cliente.json fica em scripts/cliente-config.mjs.

use std::path::Path;

const CLIENTE_PADRAO: &str = "forja";

fn campo(json: &serde_json::Value, nome: &str, arquivo: &Path) -> String {
    let valor = json[nome]
        .as_str()
        .unwrap_or_else(|| panic!("\"{nome}\" ausente em {}", arquivo.display()));
    assert!(
        !valor.is_empty() && !valor.contains(['/', '\\', '"']),
        "\"{nome}\" inválido em {}",
        arquivo.display()
    );
    valor.to_string()
}

fn main() {
    println!("cargo:rerun-if-env-changed=CLIENTE");
    let cliente = std::env::var("CLIENTE")
        .ok()
        .filter(|c| !c.trim().is_empty())
        .unwrap_or_else(|| CLIENTE_PADRAO.to_string());
    let arquivo = Path::new("..").join("clientes").join(cliente.trim()).join("cliente.json");
    println!("cargo:rerun-if-changed={}", arquivo.display());
    let texto = std::fs::read_to_string(&arquivo)
        .unwrap_or_else(|e| panic!("cliente não encontrado ({}): {e}", arquivo.display()));
    let json: serde_json::Value = serde_json::from_str(&texto)
        .unwrap_or_else(|e| panic!("{} não é um JSON válido: {e}", arquivo.display()));

    println!("cargo:rustc-env=PAINEL_CLIENTE={}", cliente.trim());
    let nome = campo(&json, "nomeCurto", &arquivo);
    println!("cargo:rustc-env=PAINEL_TITULO={nome} — Painel de Avaliações");

    tauri_build::build()
}
