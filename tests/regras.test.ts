import { describe, expect, it } from "vitest";

import {
  formatarTelefone,
  normalizarTelefone,
  somarDias,
  telefoneValido,
} from "../shared/avaliacoes/formato";
import { mensagemDiaVazio } from "../shared/avaliacoes/mensagens-vazias";
import { validarAvaliacao } from "../shared/avaliacoes/validacao";

const HOJE = "2026-10-29";

describe("telefone", () => {
  it("remove pontuação, +55 e zero inicial", () => {
    expect(normalizarTelefone("+55 (21) 99999-9999")).toBe("21999999999");
    expect(normalizarTelefone("021 3456-7890")).toBe("2134567890");
  });
  it("aceita somente DDD + 8 ou 9 dígitos", () => {
    expect(telefoneValido("(21) 99999-9999")).toBe(true);
    expect(telefoneValido("(21) 3456-7890")).toBe(true);
    expect(telefoneValido("99999-9999")).toBe(false);
    expect(telefoneValido("(21) 89999-9999")).toBe(false);
    expect(telefoneValido("(20) 99999-9999")).toBe(false);
  });
  it("formata no padrão brasileiro", () => {
    expect(formatarTelefone("21999999999")).toBe("(21) 99999-9999");
    expect(formatarTelefone("2134567890")).toBe("(21) 3456-7890");
  });
});

describe("validação do cadastro", () => {
  it("todos os campos são obrigatórios", () => {
    const r = validarAvaliacao({ nome: "", data: "", horario: "", whatsapp: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.erros).sort()).toEqual(["data", "horario", "nome", "whatsapp"]);
  });
  it("recusa data e horário inexistentes", () => {
    const r = validarAvaliacao({ nome: "Ana", data: "2026-02-30", horario: "24:10", whatsapp: "21999999999" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.erros).sort()).toEqual(["data", "horario"]);
  });
  it("aceita cadastro completo, limpa espaços e guarda o telefone só com dígitos", () => {
    const r = validarAvaliacao({ nome: " Maria  Silva ", data: HOJE, horario: "08:30", whatsapp: "(21) 99999-0000" });
    expect(r.ok && r.dados).toEqual({ nome: "Maria Silva", data: HOJE, horario: "08:30", whatsapp: "21999990000" });
  });
});

describe("datas sem efeito de fuso horário", () => {
  it("soma dias atravessando meses, anos e horário de verão", () => {
    expect(somarDias("2026-10-31", 1)).toBe("2026-11-01");
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(somarDias("2027-03-01", -1)).toBe("2027-02-28");
  });
});

describe("estado vazio", () => {
  it("usa a mensagem combinada para o dia atual", () => {
    expect(mensagemDiaVazio(HOJE, HOJE)).toEqual({
      titulo: "Ops! Cadê as avaliações de hoje? 👀",
      texto:
        "Hoje não temos nenhuma avaliação cadastrada. Vamos que vamos! Bora correr atrás de novas matrículas e preencher esse painel!",
    });
  });
  it("adapta a mensagem para datas passadas e futuras", () => {
    expect(mensagemDiaVazio("2026-10-20", HOJE).texto).toContain("Não houve nenhuma avaliação em 20/10/2026");
    expect(mensagemDiaVazio("2026-11-10", HOJE).texto).toContain("Ainda não há avaliações para 10/11/2026");
    expect(mensagemDiaVazio("2026-10-30", HOJE).titulo).toBe("Amanhã ainda está livre!");
  });
});
