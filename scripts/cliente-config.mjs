// Carrega e valida clientes/<id>/cliente.json. Usado pelo Vite, pelos scripts de build e pelos testes.
// O build.rs lê o mesmo arquivo do lado do Rust.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// No bundle CJS da API não existe import.meta.dirname; lá o caminho do cliente vem de fora.
export const RAIZ = import.meta.dirname ? path.resolve(import.meta.dirname, "..") : process.cwd();
export const PASTA_CLIENTES = path.join(RAIZ, "clientes");
export const CLIENTE_PADRAO = "forja";

export const MENSAGENS_PADRAO = {
  hoje: "Olá, {{nome}}! Tudo bem? Estou passando para lembrar da sua avaliação hoje, às {{horario}}. Contamos com sua presença! Até lá!",
  futura:
    "Olá, {{nome}}! Tudo bem? Passando para lembrar que sua avaliação está agendada para o dia {{data}}, às {{horario}}. Contamos com sua presença! Até lá!",
};

const COR = /^(#[0-9a-f]{3}|#[0-9a-f]{6}|(oklch|rgb|hsl)a?\([0-9a-z .,%/-]+\))$/i;
const EXTENSOES_LOGO = [".png", ".jpg", ".jpeg", ".svg", ".webp"];

export function clienteAtual() {
  return process.env.CLIENTE?.trim() || CLIENTE_PADRAO;
}

export function listarClientes() {
  return readdirSync(PASTA_CLIENTES, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(PASTA_CLIENTES, d.name, "cliente.json")))
    .map((d) => d.name)
    .sort();
}

function texto(c, campo, regra, explicacao, erros) {
  const v = c[campo];
  if (typeof v !== "string" || !regra.test(v)) erros.push(`"${campo}": ${explicacao} (recebido: ${JSON.stringify(v)})`);
}

/** Retorna a lista de erros (vazia = válido). */
export function validarCliente(c, pasta) {
  const erros = [];
  if (!c || typeof c !== "object") return ["cliente.json deve ser um objeto"];
  texto(c, "nome", /^.{2,60}$/u, "nome da empresa, 2 a 60 caracteres", erros);
  texto(c, "nomeCurto", /^.{2,30}$/u, "nome curto, 2 a 30 caracteres", erros);
  texto(c, "produto", /^[\p{L}\p{N} -]{2,40}$/u, "nome do programa (letras, números, espaço e hífen)", erros);
  texto(c, "executavel", /^[A-Za-z0-9][A-Za-z0-9-]{1,39}$/, "nome do .exe sem espaços nem acentos", erros);
  texto(c, "identificador", /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*){2,}$/, "domínio invertido, ex.: br.com.academia.painel", erros);
  texto(c, "banco", /^[a-z0-9][a-z0-9-]*\.db$/, "arquivo .db em minúsculas, ex.: academia.db", erros);
  texto(c, "prefixoBackup", /^[a-z0-9][a-z0-9-]*$/, "prefixo em minúsculas, ex.: academia-backup", erros);
  texto(c, "versao", /^\d+\.\d+\.\d+$/, "versão no formato 1.0.0", erros);

  for (const [campo, extensoes] of [["logo", EXTENSOES_LOGO], ["icone", [".svg", ".png"]]]) {
    const v = c[campo];
    if (typeof v !== "string" || !extensoes.includes(path.extname(v).toLowerCase()) || v.includes("/") || v.includes("\\")) {
      erros.push(`"${campo}": nome de arquivo dentro da pasta do cliente (${extensoes.join(", ")})`);
    } else if (pasta && !existsSync(path.join(pasta, v))) {
      erros.push(`"${campo}": arquivo ${v} não encontrado em ${pasta}`);
    }
  }

  const cores = c.cores ?? {};
  for (const obrigatoria of ["primaria", "barraTopo"]) {
    if (!(obrigatoria in cores)) erros.push(`"cores.${obrigatoria}" é obrigatória`);
  }
  for (const [nome, valor] of Object.entries(cores)) {
    if (!["primaria", "barraTopo", "primariaSuave", "primariaTexto", "primariaContraste"].includes(nome)) {
      erros.push(`"cores.${nome}" não existe`);
    } else if (typeof valor !== "string" || !COR.test(valor)) {
      erros.push(`"cores.${nome}": use #rrggbb, rgb(), hsl() ou oklch() (recebido: ${JSON.stringify(valor)})`);
    }
  }

  const mensagens = { ...MENSAGENS_PADRAO, ...c.mensagens };
  for (const [tipo, obrigatorios] of [["hoje", ["nome", "horario"]], ["futura", ["nome", "data", "horario"]]]) {
    const m = mensagens[tipo];
    if (typeof m !== "string" || m.length < 10) {
      erros.push(`"mensagens.${tipo}" deve ser um texto`);
      continue;
    }
    for (const chave of obrigatorios) {
      if (!m.includes(`{{${chave}}}`)) erros.push(`"mensagens.${tipo}" precisa de {{${chave}}}`);
    }
    // O redirecionamento do wa.me corrompe emojis (viram "�"), por isso são recusados.
    if (/\p{Extended_Pictographic}/u.test(m)) erros.push(`"mensagens.${tipo}" não pode ter emoji (o wa.me corrompe)`);
  }
  return erros;
}

export function carregarCliente(id = clienteAtual()) {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`Cliente "${id}" inválido: use letras minúsculas, números e hífen.`);
  const pasta = path.join(PASTA_CLIENTES, id);
  if (!existsSync(path.join(pasta, "cliente.json"))) {
    throw new Error(`Cliente "${id}" não encontrado (${pasta}). Disponíveis: ${listarClientes().join(", ")}`);
  }
  return carregarClienteDaPasta(pasta, id);
}

export function carregarClienteDaPasta(pasta, id = path.basename(pasta)) {
  const arquivo = path.join(pasta, "cliente.json");
  const bruto = JSON.parse(readFileSync(arquivo, "utf8"));
  const erros = validarCliente(bruto, pasta);
  if (erros.length) throw new Error(`clientes/${id}/cliente.json inválido:\n  - ${erros.join("\n  - ")}`);
  const cores = bruto.cores;
  return {
    ...bruto,
    id,
    pasta,
    caminhoLogo: path.join(pasta, bruto.logo),
    caminhoIcone: path.join(pasta, bruto.icone),
    mensagens: { ...MENSAGENS_PADRAO, ...bruto.mensagens },
    cores: {
      primaria: cores.primaria,
      barraTopo: cores.barraTopo,
      primariaSuave: cores.primariaSuave ?? `color-mix(in oklch, ${cores.primaria} 10%, white)`,
      primariaTexto: cores.primariaTexto ?? `color-mix(in oklch, ${cores.primaria} 75%, black)`,
      primariaContraste: cores.primariaContraste ?? "oklch(0.99 0 0)",
    },
  };
}

export function cssDaMarca(cliente) {
  const c = cliente.cores;
  // ":root:root" vence o :root do globals.css independentemente da ordem dos estilos.
  return `:root:root{--marca-primaria:${c.primaria};--marca-barra:${c.barraTopo};--primary-soft:${c.primariaSuave};--accent:${c.primariaSuave};--accent-foreground:${c.primariaTexto};--primary-foreground:${c.primariaContraste};}`;
}

export function preencherModelo(modelo, cliente) {
  return modelo.replace(/\{\{(\w+)\}\}/g, (marca, chave) =>
    typeof cliente[chave] === "string" ? cliente[chave] : marca,
  );
}
