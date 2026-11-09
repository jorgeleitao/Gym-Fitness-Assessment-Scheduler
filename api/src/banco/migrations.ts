import v1 from "../../migrations/0001_criar_avaliacoes.sql";
import v2 from "../../migrations/0002_situacao.sql";

/** Em ordem. A posição + 1 é gravada em PRAGMA user_version. */
export const MIGRATIONS: string[] = [v1, v2];
