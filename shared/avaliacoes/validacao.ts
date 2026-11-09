import type { AvaliacaoInput } from "./tipos";
import { dataValida, horarioValido, normalizarTelefone, telefoneValido } from "./formato";

export type ErrosAvaliacao = Partial<Record<keyof AvaliacaoInput, string>>;

export type ResultadoValidacao =
  | { ok: true; dados: AvaliacaoInput }
  | { ok: false; erros: ErrosAvaliacao };

export const NOME_MAX = 100;

export class ErroValidacao extends Error {}

export function validarAvaliacao(input: Partial<AvaliacaoInput>): ResultadoValidacao {
  const erros: ErrosAvaliacao = {};
  const nome = String(input.nome ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const data = String(input.data ?? "").trim();
  const horario = String(input.horario ?? "").trim();
  const whatsappBruto = String(input.whatsapp ?? "");

  if (!nome) erros.nome = "Informe o nome do cliente.";
  else if (nome.length < 2) erros.nome = "O nome precisa ter pelo menos 2 letras.";
  else if (nome.length > NOME_MAX) erros.nome = `O nome pode ter no máximo ${NOME_MAX} caracteres.`;

  if (!data) erros.data = "Escolha a data da avaliação.";
  else if (!dataValida(data)) erros.data = "Data inválida.";

  if (!horario) erros.horario = "Escolha o horário da avaliação.";
  else if (!horarioValido(horario)) erros.horario = "Horário inválido.";

  if (!whatsappBruto.trim()) erros.whatsapp = "Informe o WhatsApp com DDD.";
  else if (!telefoneValido(whatsappBruto))
    erros.whatsapp = "Número inválido. Use DDD + número, ex.: (21) 99999-9999.";

  if (Object.keys(erros).length > 0) return { ok: false, erros };

  return {
    ok: true,
    dados: { nome, data, horario, whatsapp: normalizarTelefone(whatsappBruto) },
  };
}

export function exigirAvaliacaoValida(input: Partial<AvaliacaoInput>): AvaliacaoInput {
  const r = validarAvaliacao(input);
  if (!r.ok) throw new ErroValidacao(Object.values(r.erros)[0] ?? "Dados inválidos.");
  return r.dados;
}
