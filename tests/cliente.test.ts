import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  carregarCliente,
  cssDaMarca,
  listarClientes,
  MENSAGENS_PADRAO,
  PASTA_CLIENTES,
  preencherModelo,
  validarCliente,
} from "../scripts/cliente-config.mjs";

function clienteValido(): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(PASTA_CLIENTES, "forja", "cliente.json"), "utf8"));
}

describe("clientes cadastrados (white label)", () => {
  it.each(listarClientes())("%s tem configuração válida e arquivos presentes", (id) => {
    expect(() => carregarCliente(id)).not.toThrow();
  });

  it("cada cliente tem identificador, banco e executável próprios", () => {
    const clientes = listarClientes().map((id) => carregarCliente(id));
    for (const campo of ["identificador", "banco", "executavel", "produto"] as const) {
      const valores = clientes.map((c) => c[campo]);
      expect(new Set(valores).size, campo).toBe(valores.length);
    }
  });

  it("cliente sem mensagens próprias usa o lembrete padrão", () => {
    expect(carregarCliente("forja").mensagens).toEqual(MENSAGENS_PADRAO);
  });

  it("cliente inexistente gera erro com a lista de disponíveis", () => {
    expect(() => carregarCliente("nao-existe")).toThrow(/Disponíveis: .*forja/);
    expect(() => carregarCliente("../forja")).toThrow(/inválido/);
  });
});

describe("validação do cliente.json", () => {
  it("aceita um cliente válido", () => {
    expect(validarCliente(clienteValido())).toEqual([]);
  });

  it.each([
    ["identificador", "Br.Com.Academia", "identificador"],
    ["executavel", "Academia Painel", "executavel"],
    ["banco", "../dados.db", "banco"],
    ["versao", "1.0", "versao"],
    ["logo", "../logo.png", "logo"],
  ])("recusa %s = %j", (campo, valor, esperado) => {
    const erros = validarCliente({ ...clienteValido(), [campo]: valor });
    expect(erros.join("\n")).toContain(`"${esperado}"`);
  });

  it("recusa cores que permitiriam injetar CSS", () => {
    const c = clienteValido();
    const erros = validarCliente({ ...c, cores: { primaria: "red;}body{display:none", barraTopo: "#000" } });
    expect(erros.join("\n")).toContain("cores.primaria");
  });

  it("exige as variáveis do lembrete e recusa emoji (o wa.me corrompe)", () => {
    const c = clienteValido();
    const semHorario = validarCliente({ ...c, mensagens: { hoje: "Olá {{nome}}, até hoje!" } });
    expect(semHorario).toContain('"mensagens.hoje" precisa de {{horario}}');
    const comEmoji = validarCliente({ ...c, mensagens: { hoje: "Olá {{nome}}, às {{horario}} 😊" } });
    expect(comEmoji.join("\n")).toContain("emoji");
  });
});

describe("marca aplicada na interface", () => {
  it("cores derivadas quando o cliente informa só a primária", () => {
    const css = cssDaMarca(carregarCliente("forja"));
    expect(css).toContain("--marca-primaria:#f25c1f");
    expect(css).toContain("--primary-soft:color-mix(in oklch, #f25c1f 10%, white)");
  });

  it("LEIA-ME não fica com marcações sem preencher", () => {
    const modelo = readFileSync(path.join(PASTA_CLIENTES, "..", "docs", "LEIA-ME-CLIENTE.txt"), "utf8");
    const c = carregarCliente("forja");
    const texto = preencherModelo(modelo, { ...c, nomeCurtoMaiusculo: "FORJA", instalador: "x.exe" } as typeof c);
    expect(texto).not.toMatch(/\{\{/);
    expect(texto).toContain("br.com.forja.painel\\forja.db");
  });
});
