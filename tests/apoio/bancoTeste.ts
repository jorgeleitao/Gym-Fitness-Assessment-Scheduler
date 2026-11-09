// SQLite real para os testes (node:sqlite), com as MESMAS migrations e consultas da API.
import { readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { ExecutorSql } from "../../shared/avaliacoes/executor-sql";

const MIGRATIONS = ["0001_criar_avaliacoes.sql", "0002_situacao.sql"].map((f) =>
  readFileSync(path.resolve(import.meta.dirname, "../../api/migrations", f), "utf8"),
);

export function abrirBanco(arquivo = ":memory:") {
  const db = new DatabaseSync(arquivo);
  // Mesmo controle da API: só aplica as migrations que faltam (PRAGMA user_version).
  const versao = Number(db.prepare("PRAGMA user_version").get()?.user_version ?? 0);
  MIGRATIONS.slice(versao).forEach((sql, i) => {
    db.exec(sql);
    db.exec(`PRAGMA user_version = ${versao + i + 1}`);
  });
  const executor: ExecutorSql = {
    async select<T>(sql: string, parametros: unknown[] = []) {
      return db.prepare(sql).all(...(parametros as never[])) as T;
    },
    async execute(sql: string, parametros: unknown[] = []) {
      const r = db.prepare(sql).run(...(parametros as never[]));
      return { rowsAffected: Number(r.changes) };
    },
  };
  return { db, executor };
}
