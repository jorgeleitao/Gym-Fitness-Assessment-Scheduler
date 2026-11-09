import { describe, expect, it } from "vitest";

import { MENSAGENS_PADRAO } from "../scripts/cliente-config.mjs";
import { criarRepositorioAvaliacoes } from "../shared/avaliacoes/repositorio";
import { criarServicoAvaliacoes } from "../shared/avaliacoes/servico";
import { pendente } from "../shared/avaliacoes/situacao";

import { abrirBanco } from "./apoio/bancoTeste";

const HOJE = "2026-10-29";

function novoServico() {
  return criarServicoAvaliacoes({ repo: criarRepositorioAvaliacoes(abrirBanco().executor), mensagens: MENSAGENS_PADRAO });
}

const base = { whatsapp: "21999999999", horario: "10:00" };

describe("situação da avaliação", () => {
  it("toda avaliação nova começa agendada, sem remarcação", async () => {
    const a = await novoServico().criar({ ...base, nome: "Ana", data: HOJE });
    expect(a).toMatchObject({ situacao: "agendada", remarcacoes: 0, remarcadaDe: null });
  });

  it("marca compareceu e faltou no dia ou depois, nunca antes", async () => {
    const s = novoServico();
    const hoje = await s.criar({ ...base, nome: "Bia", data: HOJE });
    const ontem = await s.criar({ ...base, nome: "Caio", data: "2026-10-28" });
    const amanha = await s.criar({ ...base, nome: "Duda", data: "2026-10-30" });

    await s.marcarSituacao(hoje.id, "compareceu", HOJE);
    await s.marcarSituacao(ontem.id, "faltou", HOJE);
    await expect(s.marcarSituacao(amanha.id, "compareceu", HOJE)).rejects.toThrow(/no dia da avaliação ou depois/);
    await expect(s.marcarSituacao(amanha.id, "faltou", HOJE)).rejects.toThrow(/no dia da avaliação ou depois/);

    const [b] = await s.listarPorData(HOJE);
    expect(b?.situacao).toBe("compareceu");
  });

  it("cancelar vale para qualquer data e pode ser desfeito voltando para agendada", async () => {
    const s = novoServico();
    const a = await s.criar({ ...base, nome: "Eva", data: "2026-11-05" });
    await s.marcarSituacao(a.id, "cancelada", HOJE);
    expect((await s.listarPorData("2026-11-05"))[0]?.situacao).toBe("cancelada");
    await s.marcarSituacao(a.id, "agendada", HOJE);
    expect((await s.listarPorData("2026-11-05"))[0]?.situacao).toBe("agendada");
  });

  it("remarcar muda data e horário, volta para agendada e guarda de onde veio", async () => {
    const s = novoServico();
    const a = await s.criar({ ...base, nome: "Fábio", data: "2026-10-27" });
    await s.marcarSituacao(a.id, "faltou", HOJE);

    const r1 = await s.remarcar(a.id, { data: "2026-11-02", horario: "08:00" }, HOJE);
    expect(r1).toMatchObject({ data: "2026-11-02", horario: "08:00", situacao: "agendada", remarcacoes: 1, remarcadaDe: "2026-10-27 10:00" });

    const r2 = await s.remarcar(a.id, { data: "2026-11-03", horario: "09:30" }, HOJE);
    expect(r2).toMatchObject({ remarcacoes: 2, remarcadaDe: "2026-11-02 08:00" });
  });

  it("não remarca para o passado, para o mesmo horário nem avaliação já feita", async () => {
    const s = novoServico();
    const a = await s.criar({ ...base, nome: "Gil", data: HOJE });
    await expect(s.remarcar(a.id, { data: "2026-10-01", horario: "10:00" }, HOJE)).rejects.toThrow(/data futura/);
    await expect(s.remarcar(a.id, { data: HOJE, horario: "10:00" }, HOJE)).rejects.toThrow(/diferente/);
    await expect(s.remarcar(a.id, { data: "2026-13-01", horario: "10:00" }, HOJE)).rejects.toThrow(/Data inválida/);
    await s.marcarSituacao(a.id, "compareceu", HOJE);
    await expect(s.remarcar(a.id, { data: "2026-11-01", horario: "10:00" }, HOJE)).rejects.toThrow(/já foi feita/);
  });

  it("lembrete só para avaliação agendada", async () => {
    const s = novoServico();
    const a = await s.criar({ ...base, nome: "Hugo", data: HOJE });
    await s.marcarSituacao(a.id, "cancelada", HOJE);
    await expect(s.gerarLembrete(a.id, HOJE)).rejects.toThrow(/Só avaliações agendadas/);
  });

  it("indicadores: comparecimento dos últimos 30 dias, pendentes e futuras", async () => {
    const s = novoServico();
    const criar = (nome: string, data: string) => s.criar({ ...base, nome, data });
    const veio = await criar("Ivo", "2026-10-20");
    const faltou = await criar("Jade", "2026-10-21");
    const antigo = await criar("Kátia", "2026-09-01"); // fora dos 30 dias
    await criar("Léo", "2026-10-25"); // passou e ninguém marcou
    const cancelada = await criar("Mia", HOJE);
    await criar("Nina", HOJE);
    await criar("Otto", "2026-11-10");

    await s.marcarSituacao(veio.id, "compareceu", HOJE);
    await s.marcarSituacao(faltou.id, "faltou", HOJE);
    await s.marcarSituacao(antigo.id, "compareceu", HOJE);
    await s.marcarSituacao(cancelada.id, "cancelada", HOJE);

    expect(await s.contadores(HOJE)).toEqual({
      hoje: 1,
      futuras: 1,
      total: 7,
      compareceram: 1,
      faltaram: 1,
      pendentes: 1,
    });
  });

  it("pendente: passou e continua agendada", () => {
    expect(pendente({ data: "2026-10-28", situacao: "agendada" }, HOJE)).toBe(true);
    expect(pendente({ data: "2026-10-28", situacao: "faltou" }, HOJE)).toBe(false);
    expect(pendente({ data: HOJE, situacao: "agendada" }, HOJE)).toBe(false);
  });
});
