// No app é o plugin SQL do Tauri; nos testes, o node:sqlite. As consultas são as mesmas.
export interface ExecutorSql {
  select<T>(sql: string, parametros?: unknown[]): Promise<T>;
  execute(sql: string, parametros?: unknown[]): Promise<{ rowsAffected: number }>;
}
