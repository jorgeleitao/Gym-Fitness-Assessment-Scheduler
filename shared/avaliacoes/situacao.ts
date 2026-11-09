import { dataValida, horarioValido, somarDias } from "./formato";
import type { Avaliacao, Situacao } from "./tipos";

export const SITUACOES: readonly Situacao[] = ["agendada", "compareceu", "faltou", "cancelada"];

/** Janela do indicador de comparecimento. */
export const DIAS_COMPARECIMENTO = 30;

export class ErroSituacao extends Error {}

export function situacaoValida(valor: unknown): valor is Situacao {
  return typeof valor === "string" && (SITUACOES as readonly string[]).includes(valor);
}

/** Avaliação que já passou e ninguém marcou se o aluno foi. */
export function pendente(a: Pick<Avaliacao, "data" | "situacao">, hoje: string): boolean {
  return a.situacao === "agendada" && a.data < hoje;
}

/** Início do período do indicador de comparecimento (inclusive). */
export function inicioComparecimento(hoje: string): string {
  return somarDias(hoje, -(DIAS_COMPARECIMENTO - 1));
}

/**
 * Regras para mudar a situação:
 * - "compareceu" e "faltou" só valem para avaliações de hoje ou passadas;
 * - "agendada" desfaz uma marcação feita por engano.
 */
export function exigirMudancaDeSituacao(a: Pick<Avaliacao, "data" | "situacao">, nova: Situacao, hoje: string) {
  if (a.situacao === nova) return;
  if ((nova === "compareceu" || nova === "faltou") && a.data > hoje) {
    throw new ErroSituacao("Só dá para marcar presença ou falta no dia da avaliação ou depois.");
  }
}

/**
 * Remarcar leva a avaliação para outra data e horário, volta a situação para "agendada"
 * e guarda de onde ela veio. Não vale para avaliação que o aluno já fez.
 */
export function exigirRemarcacao(
  a: Pick<Avaliacao, "data" | "horario" | "situacao">,
  nova: { data: string; horario: string },
  hoje: string,
) {
  if (a.situacao === "compareceu") {
    throw new ErroSituacao("Esta avaliação já foi feita. Cadastre uma nova avaliação.");
  }
  if (!dataValida(nova.data)) throw new ErroSituacao("Data inválida.");
  if (!horarioValido(nova.horario)) throw new ErroSituacao("Horário inválido.");
  if (nova.data < hoje) throw new ErroSituacao("Escolha hoje ou uma data futura para remarcar.");
  if (nova.data === a.data && nova.horario === a.horario) {
    throw new ErroSituacao("Escolha uma data ou horário diferente do atual.");
  }
}
