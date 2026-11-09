import { describe, expect, it } from "vitest";

import { MENSAGENS_PADRAO as M } from "../scripts/cliente-config.mjs";
import { criarRepositorioAvaliacoes } from "../shared/avaliacoes/repositorio";
import { criarServicoAvaliacoes } from "../shared/avaliacoes/servico";
import {
  ErroLembrete,
  gerarLinkWhatsApp,
  montarMensagem,
  numeroInternacional,
} from "../shared/avaliacoes/whatsapp";

import { abrirBanco } from "./apoio/bancoTeste";

function novoServico() {
  return criarServicoAvaliacoes({ repo: criarRepositorioAvaliacoes(abrirBanco().executor), mensagens: M });
}

const HOJE = "2026-10-29";

function textoDoLink(link: string): string {
  return decodeURIComponent(link.split("?text=")[1] ?? "");
}

describe("normalização do telefone para o WhatsApp", () => {
  it("remove máscara e adiciona o 55", () => {
    expect(numeroInternacional("(21) 99999-9999")).toBe("5521999999999");
    expect(numeroInternacional("21 3456-7890")).toBe("552134567890");
  });
  it("não duplica o código do país", () => {
    expect(numeroInternacional("+55 (21) 99999-9999")).toBe("5521999999999");
    expect(numeroInternacional("5521999999999")).toBe("5521999999999");
  });
  it("mantém DDD 55 (RS) sem confundir com o código do país", () => {
    expect(numeroInternacional("(55) 99999-1234")).toBe("5555999991234");
  });
  it("recusa números sem DDD ou incompletos", () => {
    expect(() => numeroInternacional("99999-9999")).toThrow(ErroLembrete);
    expect(() => numeroInternacional("(21) 9999")).toThrow(ErroLembrete);
    expect(() => numeroInternacional("")).toThrow(ErroLembrete);
  });
});

describe("mensagem do lembrete", () => {
  it("avaliação hoje usa o modelo de hoje com nome e horário reais", () => {
    expect(montarMensagem({ nome: "João da Silva", data: HOJE, horario: "15:30" }, HOJE, M)).toBe(
      "Olá, João da Silva! Tudo bem? Estou passando para lembrar da sua avaliação hoje, às 15:30. Contamos com sua presença! Até lá!",
    );
  });

  it("avaliação futura informa a data no padrão brasileiro", () => {
    expect(montarMensagem({ nome: "Ana Lúcia", data: "2026-11-05", horario: "08:00" }, HOJE, M)).toBe(
      "Olá, Ana Lúcia! Tudo bem? Passando para lembrar que sua avaliação está agendada para o dia 05/11/2026, às 08:00. Contamos com sua presença! Até lá!",
    );
  });

  it("avaliação passada não gera lembrete", () => {
    expect(() => montarMensagem({ nome: "Zé", data: "2026-10-28", horario: "10:00" }, HOJE, M)).toThrow(
      /já passou/,
    );
  });

  it("nomes com caracteres especiais são inseridos literalmente", () => {
    const m = montarMensagem({ nome: "Maria $& {{horario}}", data: HOJE, horario: "09:00" }, HOJE, M);
    expect(m).toContain("Olá, Maria $& {{horario}}!");
  });
});

describe("link do WhatsApp", () => {
  it("usa o número normalizado e codifica acentos, espaços e emoji", () => {
    const link = gerarLinkWhatsApp(
      { nome: "João da Silva", whatsapp: "(21) 99999-9999", data: HOJE, horario: "15:30" },
      HOJE,
      M,
    );
    expect(link.startsWith("https://wa.me/5521999999999?text=")).toBe(true);
    expect(link).not.toMatch(/[ ÀÁÂÃÉÊÍÓÔÕÚÇàáâãéêíóôõúç]/);
    expect(link).toContain("Jo%C3%A3o%20da%20Silva");
    expect(link).not.toContain("%F0%9F"); // sem emoji: o wa.me corrompe emojis no redirecionamento
    expect(textoDoLink(link)).toBe(
      "Olá, João da Silva! Tudo bem? Estou passando para lembrar da sua avaliação hoje, às 15:30. Contamos com sua presença! Até lá!",
    );
  });
});

describe("lembrete gerado pelo serviço (SQLite)", () => {
  it("cada avaliação gera o link com o próprio nome, telefone, data e horário", async () => {
    const servico = novoServico();

    const joao = await servico.criar({ nome: "João da Silva", whatsapp: "(21) 99999-9999", data: HOJE, horario: "15:30" });
    const ana = await servico.criar({ nome: "Ana Lúcia", whatsapp: "(11) 98765-4321", data: "2026-11-05", horario: "08:00" });
    const beto = await servico.criar({ nome: "Beto Araújo", whatsapp: "+55 31 3222-1100", data: HOJE, horario: "07:15" });

    const esperado = [
      [joao.id, "5521999999999", "Olá, João da Silva!", "hoje, às 15:30"],
      [ana.id, "5511987654321", "Olá, Ana Lúcia!", "dia 05/11/2026, às 08:00"],
      [beto.id, "553132221100", "Olá, Beto Araújo!", "hoje, às 07:15"],
    ] as const;

    for (const [id, numero, saudacao, quando] of esperado) {
      const link = await servico.gerarLembrete(id, HOJE);
      expect(link.startsWith(`https://wa.me/${numero}?text=`)).toBe(true);
      const texto = textoDoLink(link);
      expect(texto).toContain(saudacao);
      expect(texto).toContain(quando);
    }
  });

  it("usa os dados atuais do banco depois de uma edição", async () => {
    const servico = novoServico();
    const a = await servico.criar({ nome: "Carla", whatsapp: "21999990000", data: HOJE, horario: "10:00" });
    await servico.atualizar(a.id, { nome: "Carla Mendes", whatsapp: "(21) 98888-7777", data: HOJE, horario: "11:45" });

    const link = await servico.gerarLembrete(a.id, HOJE);
    expect(link.startsWith("https://wa.me/5521988887777?text=")).toBe(true);
    expect(textoDoLink(link)).toContain("Olá, Carla Mendes! Tudo bem? Estou passando para lembrar da sua avaliação hoje, às 11:45.");
  });

  it("não gera link para avaliação passada ou inexistente", async () => {
    const servico = novoServico();
    const a = await servico.criar({ nome: "Eva", whatsapp: "21999990000", data: "2026-10-01", horario: "10:00" });
    await expect(servico.gerarLembrete(a.id, HOJE)).rejects.toThrow(/já passou/);
    await expect(servico.gerarLembrete("nao-existe", HOJE)).rejects.toThrow(/não existe/);
  });
});
