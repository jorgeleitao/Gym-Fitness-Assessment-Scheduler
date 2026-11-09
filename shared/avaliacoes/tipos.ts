/** O que aconteceu com a avaliação. */
export type Situacao = "agendada" | "compareceu" | "faltou" | "cancelada";

/** Uma avaliação agendada. Datas em "AAAA-MM-DD" e horários em "HH:mm" (horário local). */
export interface Avaliacao {
  id: string;
  nome: string;
  data: string;
  horario: string;
  /** Somente dígitos, com DDD e sem o código do país (ex.: "21999999999"). */
  whatsapp: string;
  situacao: Situacao;
  /** Quantas vezes a avaliação foi remarcada. */
  remarcacoes: number;
  /** Data e horário antes da última remarcação ("AAAA-MM-DD HH:mm"), ou null. */
  remarcadaDe: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export type AvaliacaoInput = Pick<Avaliacao, "nome" | "data" | "horario" | "whatsapp">;

export interface Contadores {
  /** Avaliações de hoje, sem as canceladas. */
  hoje: number;
  /** Avaliações agendadas de amanhã em diante. */
  futuras: number;
  total: number;
  /** Últimos 30 dias, até hoje. */
  compareceram: number;
  faltaram: number;
  /** Avaliações que já passaram e continuam como "agendada" (falta marcar o que aconteceu). */
  pendentes: number;
}
