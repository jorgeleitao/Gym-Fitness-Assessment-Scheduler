import type { ExecutorSql } from "./executor-sql";

import { semAcentos, somenteDigitos } from "./formato";
import { inicioComparecimento } from "./situacao";
import type { Avaliacao, AvaliacaoInput, Contadores, Situacao } from "./tipos";

interface LinhaAvaliacao {
  id: string;
  nome: string;
  whatsapp: string;
  data_avaliacao: string;
  horario_avaliacao: string;
  situacao: Situacao;
  remarcacoes: number;
  remarcada_de: string | null;
  criado_em: string;
  atualizado_em: string;
}

const COLUNAS =
  "id, nome, whatsapp, data_avaliacao, horario_avaliacao, situacao, remarcacoes, remarcada_de, criado_em, atualizado_em";

// Empate de horário: ordem alfabética sem considerar acentos ("Álvaro" antes de "Beatriz").
const ORDEM = "ORDER BY data_avaliacao, horario_avaliacao, nome_busca";

function paraAvaliacao(l: LinhaAvaliacao): Avaliacao {
  return {
    id: l.id,
    nome: l.nome,
    whatsapp: l.whatsapp,
    data: l.data_avaliacao,
    horario: l.horario_avaliacao,
    situacao: l.situacao,
    remarcacoes: Number(l.remarcacoes),
    remarcadaDe: l.remarcada_de,
    criadoEm: l.criado_em,
    atualizadoEm: l.atualizado_em,
  };
}

// Escapa % e _ para a busca ser literal.
function padraoLike(texto: string): string {
  return `%${texto.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export function criarRepositorioAvaliacoes(db: ExecutorSql) {
  async function listar(sql: string, parametros: unknown[]): Promise<Avaliacao[]> {
    const linhas = await db.select<LinhaAvaliacao[]>(sql, parametros);
    return linhas.map(paraAvaliacao);
  }

  return {
    listarPorData(data: string): Promise<Avaliacao[]> {
      return listar(
        `SELECT ${COLUNAS} FROM avaliacoes WHERE data_avaliacao = ? ${ORDEM}`,
        [data],
      );
    },

    pesquisar(termo: string): Promise<Avaliacao[]> {
      const nome = semAcentos(termo.trim());
      if (!nome) return Promise.resolve([]);
      const digitos = somenteDigitos(termo);
      return listar(
        `SELECT ${COLUNAS} FROM avaliacoes
          WHERE nome_busca LIKE ? ESCAPE '\\'
             OR (? <> '' AND whatsapp LIKE ? ESCAPE '\\')
          ${ORDEM}`,
        [padraoLike(nome), digitos.length >= 2 ? digitos : "", padraoLike(digitos)],
      );
    },

    async buscarPorId(id: string): Promise<Avaliacao | null> {
      const [a] = await listar(`SELECT ${COLUNAS} FROM avaliacoes WHERE id = ?`, [id]);
      return a ?? null;
    },

    async contadores(hoje: string): Promise<Contadores> {
      type Linha = Record<keyof Contadores, number | null>;
      const [l] = await db.select<Linha[]>(
        `SELECT SUM(data_avaliacao = ? AND situacao <> 'cancelada') AS hoje,
                SUM(data_avaliacao > ? AND situacao = 'agendada') AS futuras,
                COUNT(*) AS total,
                SUM(data_avaliacao BETWEEN ? AND ? AND situacao = 'compareceu') AS compareceram,
                SUM(data_avaliacao BETWEEN ? AND ? AND situacao = 'faltou') AS faltaram,
                SUM(data_avaliacao < ? AND situacao = 'agendada') AS pendentes
           FROM avaliacoes`,
        [hoje, hoje, inicioComparecimento(hoje), hoje, inicioComparecimento(hoje), hoje, hoje],
      );
      return {
        hoje: l?.hoje ?? 0,
        futuras: l?.futuras ?? 0,
        total: l?.total ?? 0,
        compareceram: l?.compareceram ?? 0,
        faltaram: l?.faltaram ?? 0,
        pendentes: l?.pendentes ?? 0,
      };
    },

    async inserir(a: Avaliacao): Promise<void> {
      await db.execute(
        `INSERT INTO avaliacoes
           (id, nome, nome_busca, whatsapp, data_avaliacao, horario_avaliacao, criado_em, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [a.id, a.nome, semAcentos(a.nome), a.whatsapp, a.data, a.horario, a.criadoEm, a.atualizadoEm],
      );
    },

    async atualizar(id: string, dados: AvaliacaoInput, atualizadoEm: string): Promise<boolean> {
      const r = await db.execute(
        `UPDATE avaliacoes
            SET nome = ?, nome_busca = ?, whatsapp = ?, data_avaliacao = ?,
                horario_avaliacao = ?, atualizado_em = ?
          WHERE id = ?`,
        [dados.nome, semAcentos(dados.nome), dados.whatsapp, dados.data, dados.horario, atualizadoEm, id],
      );
      return r.rowsAffected > 0;
    },

    async definirSituacao(id: string, situacao: Situacao, atualizadoEm: string): Promise<boolean> {
      const r = await db.execute("UPDATE avaliacoes SET situacao = ?, atualizado_em = ? WHERE id = ?", [
        situacao,
        atualizadoEm,
        id,
      ]);
      return r.rowsAffected > 0;
    },

    async remarcar(
      id: string,
      nova: { data: string; horario: string },
      remarcadaDe: string,
      atualizadoEm: string,
    ): Promise<boolean> {
      const r = await db.execute(
        `UPDATE avaliacoes
            SET data_avaliacao = ?, horario_avaliacao = ?, situacao = 'agendada',
                remarcacoes = remarcacoes + 1, remarcada_de = ?, atualizado_em = ?
          WHERE id = ?`,
        [nova.data, nova.horario, remarcadaDe, atualizadoEm, id],
      );
      return r.rowsAffected > 0;
    },

    async excluir(id: string): Promise<boolean> {
      const r = await db.execute("DELETE FROM avaliacoes WHERE id = ?", [id]);
      return r.rowsAffected > 0;
    },
  };
}

export type RepositorioAvaliacoes = ReturnType<typeof criarRepositorioAvaliacoes>;
