import { formatarData, normalizarTelefone, telefoneValido } from "./formato";
import type { Avaliacao } from "./tipos";

/** Modelos com {{nome}}, {{data}} e {{horario}} (campo "mensagens" do cliente.json). */
export interface MensagensLembrete {
  hoje: string;
  futura: string;
}

export type DadosLembrete = Pick<Avaliacao, "nome" | "data" | "horario" | "whatsapp">;

export class ErroLembrete extends Error {}

export type SituacaoLembrete = "hoje" | "futura" | "passada";

export function situacaoLembrete(data: string, hoje: string): SituacaoLembrete {
  if (data === hoje) return "hoje";
  return data > hoje ? "futura" : "passada";
}

/** "(21) 99999-9999" -> "5521999999999" */
export function numeroInternacional(telefone: string): string {
  if (!telefoneValido(telefone)) {
    throw new ErroLembrete(
      "O WhatsApp cadastrado é inválido. Edite a avaliação e informe DDD + número.",
    );
  }
  return `55${normalizarTelefone(telefone)}`;
}

function preencher(modelo: string, valores: Record<string, string>): string {
  // Função em vez de string: um "$" no nome não vira padrão do replace.
  return modelo.replace(/\{\{(\w+)\}\}/g, (_, chave: string) => valores[chave] ?? "");
}

export function montarMensagem(
  a: Pick<Avaliacao, "nome" | "data" | "horario">,
  hoje: string,
  mensagens: MensagensLembrete,
): string {
  const situacao = situacaoLembrete(a.data, hoje);
  if (situacao === "passada") {
    throw new ErroLembrete("Esta avaliação já passou. Não é possível enviar lembrete.");
  }
  const modelo = situacao === "hoje" ? mensagens.hoje : mensagens.futura;
  return preencher(modelo, { nome: a.nome, data: formatarData(a.data), horario: a.horario });
}

export function gerarLinkWhatsApp(a: DadosLembrete, hoje: string, mensagens: MensagensLembrete): string {
  const numero = numeroInternacional(a.whatsapp);
  const texto = encodeURIComponent(montarMensagem(a, hoje, mensagens));
  return `https://wa.me/${numero}?text=${texto}`;
}
