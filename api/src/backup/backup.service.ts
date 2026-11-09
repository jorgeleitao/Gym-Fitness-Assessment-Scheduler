import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { Inject, Injectable } from "@nestjs/common";

import { dataValida, horarioValido } from "../../../shared/avaliacoes/formato";
import { situacaoValida } from "../../../shared/avaliacoes/situacao";
import { BancoService } from "../banco/banco.service";
import { CONFIG, type Configuracao } from "../config";

export class ErroBackup extends Error {}

/** Colunas que todo backup tem (desde a primeira versão). */
const COLUNAS = [
  "id",
  "nome",
  "nome_busca",
  "whatsapp",
  "data_avaliacao",
  "horario_avaliacao",
  "criado_em",
  "atualizado_em",
];

/** Colunas da versão 2. Backups antigos não têm; ao restaurar, ficam com o valor padrão. */
const COLUNAS_V2 = ["situacao", "remarcacoes", "remarcada_de"];

function carimbo(agora = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}_${p(agora.getHours())}-${p(agora.getMinutes())}-${p(agora.getSeconds())}`;
}

/** Executa `fn` com o arquivo gravado numa pasta temporária e apaga a pasta no final. */
function comArquivoTemporario<T>(conteudo: Buffer | null, fn: (arquivo: string) => T): T {
  const pasta = mkdtempSync(path.join(tmpdir(), "painel-backup-"));
  const arquivo = path.join(pasta, "backup.db");
  try {
    if (conteudo) writeFileSync(arquivo, conteudo);
    return fn(arquivo);
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
}

@Injectable()
export class BackupService {
  constructor(
    @Inject(BancoService) private readonly banco: BancoService,
    @Inject(CONFIG) private readonly config: Configuracao,
  ) {}

  /** Cópia consistente do banco (VACUUM INTO), conferida antes de ser entregue. */
  exportar(): { nome: string; conteudo: Buffer } {
    return comArquivoTemporario(null, (arquivo) => {
      this.banco.db.prepare("VACUUM INTO ?").run(arquivo);
      this.inspecionarArquivo(arquivo);
      return { nome: `${this.config.cliente.prefixoBackup}-${carimbo()}.db`, conteudo: readFileSync(arquivo) };
    });
  }

  inspecionar(conteudo: Buffer): { total: number } {
    return comArquivoTemporario(conteudo, (arquivo) => ({ total: this.inspecionarArquivo(arquivo).total }));
  }

  /**
   * Valida o backup, guarda uma cópia dos dados atuais e troca as avaliações
   * numa única transação: ou tudo é restaurado, ou nada muda.
   */
  restaurar(conteudo: Buffer): { total: number; copiaSeguranca: string } {
    return comArquivoTemporario(conteudo, (arquivo) => {
      const { colunas } = this.inspecionarArquivo(arquivo);

      mkdirSync(this.config.pastaCopias, { recursive: true });
      const copia = path.join(this.config.pastaCopias, `antes-da-restauracao-${carimbo()}.db`);
      if (existsSync(copia)) throw new ErroBackup("Já existe uma cópia com esse horário. Tente de novo.");
      const db = this.banco.db;
      db.prepare("VACUUM INTO ?").run(copia);

      const lista = colunas.join(", ");
      db.prepare("ATTACH DATABASE ? AS backup").run(arquivo);
      try {
        db.exec("BEGIN IMMEDIATE");
        try {
          db.exec("DELETE FROM main.avaliacoes");
          const r = db.prepare(`INSERT INTO main.avaliacoes (${lista}) SELECT ${lista} FROM backup.avaliacoes`).run();
          db.exec("COMMIT");
          return { total: Number(r.changes), copiaSeguranca: copia };
        } catch (e) {
          db.exec("ROLLBACK");
          throw new ErroBackup(
            `A restauração falhou e os dados atuais foram mantidos. Detalhe: ${(e as Error).message}`,
          );
        }
      } finally {
        db.exec("DETACH DATABASE backup");
      }
    });
  }

  private inspecionarArquivo(arquivo: string): { total: number; colunas: string[] } {
    let db: DatabaseSync;
    try {
      db = new DatabaseSync(arquivo, { readOnly: true });
    } catch {
      throw new ErroBackup("O arquivo escolhido não é um banco de dados SQLite válido.");
    }
    try {
      let integridade: unknown;
      try {
        integridade = db.prepare("PRAGMA quick_check").get()?.quick_check;
      } catch {
        throw new ErroBackup("O arquivo escolhido não é um banco de dados SQLite válido.");
      }
      if (integridade !== "ok") throw new ErroBackup("O arquivo de backup está corrompido.");

      const tabela = db
        .prepare("SELECT type FROM sqlite_master WHERE name = 'avaliacoes'")
        .get() as { type?: string } | undefined;
      if (tabela?.type !== "table") {
        throw new ErroBackup("O arquivo não é um backup do Painel de Avaliações (tabela não encontrada).");
      }
      const colunas = (db.prepare("SELECT name FROM pragma_table_info('avaliacoes')").all() as { name: string }[]).map(
        (c) => c.name,
      );
      const falta = COLUNAS.find((c) => !colunas.includes(c));
      if (falta) throw new ErroBackup(`O backup está incompleto: falta a coluna "${falta}".`);
      const v2 = COLUNAS_V2.every((c) => colunas.includes(c));

      const linhas = db
        .prepare(
          `SELECT id, nome, whatsapp, data_avaliacao, horario_avaliacao${v2 ? ", situacao, remarcacoes" : ""}
             FROM avaliacoes ORDER BY rowid`,
        )
        .all() as Record<string, unknown>[];
      linhas.forEach((l, i) => {
        const campo = (nome: string) => (typeof l[nome] === "string" ? (l[nome] as string) : "");
        const nome = campo("nome");
        const valido =
          campo("id").trim() !== "" &&
          [...nome.trim()].length >= 2 &&
          /^\d{10,11}$/.test(campo("whatsapp")) &&
          dataValida(campo("data_avaliacao")) &&
          horarioValido(campo("horario_avaliacao")) &&
          (!v2 || (situacaoValida(l.situacao) && Number.isInteger(l.remarcacoes) && Number(l.remarcacoes) >= 0));
        if (!valido) {
          throw new ErroBackup(
            `O backup tem um registro inválido (nº ${i + 1}${nome ? `, "${nome}"` : ""}). Nada foi alterado.`,
          );
        }
      });
      return { total: linhas.length, colunas: v2 ? [...COLUNAS, ...COLUNAS_V2] : COLUNAS };
    } finally {
      db.close();
    }
  }
}
