// Versão desktop (Tauri) de um cliente white label.
//
//   node scripts/cliente.mjs validar [id]   confere um cliente (ou todos)
//   node scripts/cliente.mjs dev [id]       abre o app desktop sem gerar instalador
//   node scripts/cliente.mjs build [id]     .exe + instalador + distribuicao/<id>/
//
// Sem [id], usa a variável CLIENTE ou o cliente padrão (forja).
// O app desktop leva junto: o build do Angular, a API empacotada (dist/api-desktop)
// e uma cópia do node.exe usado para rodar este script.
// Gerados (fora do git): src-tauri/clientes-gerado/<id>/, src-tauri/binarios/ e distribuicao/<id>/.
import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { carregarCliente, clienteAtual, listarClientes, preencherModelo, RAIZ } from "./cliente-config.mjs";

const SRC_TAURI = path.join(RAIZ, "src-tauri");
const CLI_TAURI = path.join(RAIZ, "node_modules", "@tauri-apps", "cli", "tauri.js");

function rodar(comando, args, env = {}) {
  const r = spawnSync(comando, args, { cwd: RAIZ, stdio: "inherit", env: { ...process.env, ...env } });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

/** Build do Angular, API com todas as dependências e o node.exe que vai junto do app. */
function prepararDesktop() {
  rodar(process.execPath, [path.join(RAIZ, "node_modules", "@angular", "cli", "bin", "ng.js"), "build"]);
  rodar(process.execPath, [path.join(RAIZ, "scripts", "api.mjs"), "build", "--sidecar"]);
  const alvo = spawnSync("rustc", ["--print", "host-tuple"], { encoding: "utf8" }).stdout.trim();
  if (!alvo) throw new Error("rustc não encontrado: instale o Rust para gerar a versão desktop.");
  const pasta = path.join(SRC_TAURI, "binarios");
  mkdirSync(pasta, { recursive: true });
  const extensao = process.platform === "win32" ? ".exe" : "";
  copyFileSync(process.execPath, path.join(pasta, `painel-node-${alvo}${extensao}`));
}

// Node direto (sem shell): os caminhos podem ter espaços ("Área de Trabalho").
function tauri(cliente, args) {
  rodar(process.execPath, [CLI_TAURI, ...args], { CLIENTE: cliente.id });
}

/** Ícones + tauri.conf.json do cliente (mesclado sobre o src-tauri/tauri.conf.json via --config). */
function gerarConfiguracao(cliente) {
  const pasta = path.join(SRC_TAURI, "clientes-gerado", cliente.id);
  const icones = path.join(pasta, "icons");
  rmSync(pasta, { recursive: true, force: true });
  mkdirSync(pasta, { recursive: true });
  tauri(cliente, ["icon", cliente.caminhoIcone, "--output", icones]);

  const relativo = (arquivo) => path.relative(SRC_TAURI, path.join(icones, arquivo)).replaceAll("\\", "/");
  const config = {
    productName: cliente.produto,
    mainBinaryName: cliente.executavel,
    version: cliente.versao,
    identifier: cliente.identificador,
    bundle: {
      resources: {
        "../dist/web/browser/": "web/",
        "../dist/api-desktop/main.cjs": "api/main.cjs",
        [`../clientes/${cliente.id}/`]: "cliente/",
      },
      publisher: cliente.nome,
      shortDescription: `Painel de Avaliações — ${cliente.nome}`,
      icon: ["32x32.png", "128x128.png", "128x128@2x.png", "icon.ico"].map(relativo),
      windows: { nsis: { installerIcon: relativo("icon.ico") } },
    },
  };
  const arquivo = path.join(pasta, "tauri.conf.json");
  writeFileSync(arquivo, JSON.stringify(config, null, 2) + "\n");
  return path.relative(RAIZ, arquivo);
}

/** distribuicao/<id>/: pasta portátil e instalador, cada um com o LEIA-ME do cliente. */
function montarDistribuicao(cliente) {
  const release = path.join(SRC_TAURI, "target", "release");
  const exe = path.join(release, `${cliente.executavel}.exe`);
  const nomeInstalador = `${cliente.produto}_${cliente.versao}_x64-setup.exe`;
  const instalador = path.join(release, "bundle", "nsis", nomeInstalador);
  for (const f of [exe, instalador]) if (!existsSync(f)) throw new Error(`Não encontrado: ${f}`);

  const leiaMe = preencherModelo(readFileSync(path.join(RAIZ, "docs", "LEIA-ME-CLIENTE.txt"), "utf8"), {
    ...cliente,
    nomeCurtoMaiusculo: cliente.nomeCurto.toLocaleUpperCase("pt-BR"),
    instalador: nomeInstalador,
  });

  const destino = path.join(RAIZ, "distribuicao", cliente.id);
  rmSync(destino, { recursive: true, force: true });
  const portatil = path.join(destino, `${cliente.executavel}-Portatil`);
  const pastaInstalador = path.join(destino, "Instalador");
  for (const pasta of [portatil, pastaInstalador]) {
    mkdirSync(pasta, { recursive: true });
    writeFileSync(path.join(pasta, "LEIA-ME.txt"), leiaMe);
  }
  // A versão portátil precisa do Node e dos recursos ao lado do .exe.
  copyFileSync(exe, path.join(portatil, `${cliente.executavel}.exe`));
  copyFileSync(path.join(release, "painel-node.exe"), path.join(portatil, "painel-node.exe"));
  for (const recurso of ["web", "api", "cliente"]) {
    cpSync(path.join(release, recurso), path.join(portatil, recurso), { recursive: true });
  }
  copyFileSync(instalador, path.join(pastaInstalador, nomeInstalador));
  console.log(`\nPronto: ${destino}`);
}

const [acao, id] = process.argv.slice(2);
try {
  if (acao === "validar") {
    for (const c of id ? [id] : listarClientes()) {
      const cliente = carregarCliente(c);
      console.log(`ok  ${c.padEnd(12)} ${cliente.produto} (${cliente.identificador}, ${cliente.banco})`);
    }
  } else if (acao === "dev" || acao === "build") {
    const cliente = carregarCliente(id ?? clienteAtual());
    console.log(`Cliente: ${cliente.id} — ${cliente.produto}`);
    prepararDesktop();
    const config = gerarConfiguracao(cliente);
    tauri(cliente, [acao, "--config", config]);
    if (acao === "build") montarDistribuicao(cliente);
  } else if (acao === "distribuir") {
    montarDistribuicao(carregarCliente(id ?? clienteAtual()));
  } else {
    console.error("Uso: node scripts/cliente.mjs <validar|dev|build> [cliente]");
    process.exit(1);
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
