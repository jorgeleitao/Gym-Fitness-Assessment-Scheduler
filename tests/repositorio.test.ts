import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { MENSAGENS_PADRAO } from "../scripts/cliente-config.mjs";
import { criarRepositorioAvaliacoes } from "../shared/avaliacoes/repositorio";
import { criarServicoAvaliacoes } from "../shared/avaliacoes/servico";

import { abrirBanco } from "./apoio/bancoTeste";

const HOJE = "2026-10-29";

function novoServico(executor = abrirBanco().executor) {
  return criarServicoAvaliacoes({ repo: criarRepositorioAvaliacoes(executor), mensagens: MENSAGENS_PADRAO });
}

describe("cadastro, edição e exclusão (SQLite)", () => {
  it("cadastra com id, criado_em e atualizado_em", async () => {
    const s = novoServico();
    const a = await s.criar({ nome: "Ana", whatsapp: "(21) 99999-9999", data: HOJE, horario: "10:00" });
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.whatsapp).toBe("21999999999");
    expect(a.criadoEm).toBe(a.atualizadoEm);
    expect(await s.listarPorData(HOJE)).toEqual([a]);
  });

  it("não grava dados inválidos", async () => {
    const s = novoServico();
    await expect(s.criar({ nome: "", whatsapp: "", data: "", horario: "" })).rejects.toThrow("Informe o nome");
    await expect(s.criar({ nome: "Ana", whatsapp: "123", data: HOJE, horario: "10:00" })).rejects.toThrow(/Número inválido/);
    expect((await s.contadores(HOJE)).total).toBe(0);
  });

  it("edita sem duplicar e atualiza atualizado_em", async () => {
    let t = 0;
    const s = criarServicoAvaliacoes({
      repo: criarRepositorioAvaliacoes(abrirBanco().executor),
      mensagens: MENSAGENS_PADRAO,
      agora: () => new Date(Date.UTC(2026, 9, 29, 12, 0, t++)),
    });
    const a = await s.criar({ nome: "Bruno", whatsapp: "21999999999", data: HOJE, horario: "10:00" });
    await s.atualizar(a.id, { nome: "Bruno Costa", whatsapp: "21988887777", data: "2026-10-30", horario: "11:00" });

    expect(await s.listarPorData(HOJE)).toEqual([]);
    const [editada, ...resto] = await s.listarPorData("2026-10-30");
    expect(resto).toEqual([]);
    expect(editada).toMatchObject({ id: a.id, nome: "Bruno Costa", whatsapp: "21988887777", horario: "11:00", criadoEm: a.criadoEm });
    expect(editada!.atualizadoEm > a.atualizadoEm).toBe(true);
    expect((await s.contadores(HOJE)).total).toBe(1);
  });

  it("exclui somente a avaliação escolhida", async () => {
    const s = novoServico();
    const a = await s.criar({ nome: "Carla", whatsapp: "21999999999", data: HOJE, horario: "10:00" });
    const b = await s.criar({ nome: "Davi", whatsapp: "21999999998", data: HOJE, horario: "11:00" });
    await s.excluir(a.id);
    expect((await s.listarPorData(HOJE)).map((x) => x.id)).toEqual([b.id]);
    await expect(s.excluir(a.id)).rejects.toThrow(/já tinha sido excluída/);
    await expect(s.atualizar(a.id, { nome: "X y", whatsapp: "21999999999", data: HOJE, horario: "10:00" })).rejects.toThrow(/não existe mais/);
  });
});

describe("listagem, filtros e indicadores", () => {
  const s = novoServico();
  beforeAll(async () => {
    for (const [nome, whatsapp, data, horario] of [
      ["Carla", "21999990001", "2026-10-30", "08:00"],
      ["Bruno", "21999990002", HOJE, "15:00"],
      ["Álvaro", "21912345678", HOJE, "09:00"],
      ["Zé", "21999990003", "2026-10-01", "07:00"],
      ["Beatriz", "11987654321", HOJE, "09:00"],
    ] as const) {
      await s.criar({ nome, whatsapp, data, horario });
    }
  });

  it("mostra apenas a data selecionada, ordenada por horário", async () => {
    expect((await s.listarPorData(HOJE)).map((a) => `${a.horario} ${a.nome}`)).toEqual([
      "09:00 Álvaro",
      "09:00 Beatriz",
      "15:00 Bruno",
    ]);
    expect((await s.listarPorData("2026-10-01")).map((a) => a.nome)).toEqual(["Zé"]);
    expect((await s.listarPorData("2026-10-30")).map((a) => a.nome)).toEqual(["Carla"]);
    expect(await s.listarPorData("2026-12-25")).toEqual([]);
  });

  it("pesquisa por nome sem acento/maiúsculas e por parte do telefone", async () => {
    expect((await s.pesquisar("alvaro")).map((a) => a.nome)).toEqual(["Álvaro"]);
    expect((await s.pesquisar("BRU")).map((a) => a.nome)).toEqual(["Bruno"]);
    expect((await s.pesquisar("1234")).map((a) => a.nome)).toEqual(["Álvaro"]);
    expect((await s.pesquisar("(11) 98765")).map((a) => a.nome)).toEqual(["Beatriz"]);
    expect(await s.pesquisar("%")).toEqual([]);
    expect(await s.pesquisar("   ")).toEqual([]);
  });

  it("conta avaliações de hoje e futuras com dados reais", async () => {
    expect(await s.contadores(HOJE)).toMatchObject({ hoje: 3, futuras: 1, total: 5 });
    expect(await novoServico().contadores(HOJE)).toEqual({
      hoje: 0,
      futuras: 0,
      total: 0,
      compareceram: 0,
      faltaram: 0,
      pendentes: 0,
    });
  });
});

describe("persistência em arquivo", () => {
  const pasta = mkdtempSync(path.join(tmpdir(), "forja-"));
  afterAll(() => rmSync(pasta, { recursive: true, force: true }));

  it("os dados continuam lá depois de fechar e reabrir o banco", async () => {
    const arquivo = path.join(pasta, "forja.db");
    const primeiro = abrirBanco(arquivo);
    await novoServico(primeiro.executor).criar({ nome: "Érica Gonçalves", whatsapp: "21999999999", data: HOJE, horario: "18:30" });
    primeiro.db.close();

    // Reabrir não aplica as migrations de novo nem perde registros.
    const segundo = abrirBanco(arquivo);
    const lista = await novoServico(segundo.executor).listarPorData(HOJE);
    segundo.db.close();
    expect(lista.map((a) => a.nome)).toEqual(["Érica Gonçalves"]);
  });
});
