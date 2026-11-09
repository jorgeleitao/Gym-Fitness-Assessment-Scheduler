import { mkdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";

import type { ExecutorSql } from "../../../shared/avaliacoes/executor-sql";
import { CONFIG, type Configuracao } from "../config";
import { MIGRATIONS } from "./migrations";

@Injectable()
export class BancoService implements ExecutorSql, OnModuleDestroy {
  readonly db: DatabaseSync;

  constructor(@Inject(CONFIG) config: Configuracao) {
    mkdirSync(config.pastaDados, { recursive: true });
    this.db = new DatabaseSync(config.arquivoBanco);
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.migrar();
  }

  private migrar() {
    const versao = Number(this.db.prepare("PRAGMA user_version").get()?.user_version ?? 0);
    MIGRATIONS.forEach((sql, i) => {
      if (i < versao) return;
      this.db.exec("BEGIN");
      try {
        this.db.exec(sql);
        this.db.exec(`PRAGMA user_version = ${i + 1}`);
        this.db.exec("COMMIT");
      } catch (e) {
        this.db.exec("ROLLBACK");
        throw e;
      }
    });
  }

  async select<T>(sql: string, parametros: unknown[] = []): Promise<T> {
    return this.db.prepare(sql).all(...(parametros as SQLInputValue[])) as T;
  }

  async execute(sql: string, parametros: unknown[] = []) {
    const r = this.db.prepare(sql).run(...(parametros as SQLInputValue[]));
    return { rowsAffected: Number(r.changes) };
  }

  onModuleDestroy() {
    this.db.close();
  }
}
