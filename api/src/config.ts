import { existsSync } from "node:fs";
import path from "node:path";

import {
  carregarCliente,
  carregarClienteDaPasta,
  type Cliente,
} from "../../scripts/cliente-config.mjs";

export const CONFIG = Symbol("CONFIG");

export interface Configuracao {
  cliente: Cliente;
  porta: number;
  host: string;
  /** Valores aceitos no cabeçalho Host (proteção contra DNS rebinding). */
  hostsPermitidos: string[];
  pastaDados: string;
  arquivoBanco: string;
  pastaCopias: string;
  /** Build do Angular servido em "/". Ausente em desenvolvimento (o ng serve cuida disso). */
  pastaWeb: string | null;
}

export function lerConfiguracao(env: NodeJS.ProcessEnv = process.env): Configuracao {
  const raiz = process.cwd();
  const cliente = env.CLIENTE_DIR
    ? carregarClienteDaPasta(env.CLIENTE_DIR, env.CLIENTE?.trim() || undefined)
    : carregarCliente(env.CLIENTE?.trim() || undefined);

  const porta = Number(env.PORTA ?? 3000);
  if (!Number.isInteger(porta) || porta < 0 || porta > 65535) throw new Error(`PORTA inválida: ${env.PORTA}`);
  const host = env.HOST ?? "127.0.0.1";

  const pastaDados = path.resolve(env.DADOS_DIR ?? path.join(raiz, "dados"));
  const pastaWeb = path.resolve(env.WEB_DIR ?? path.join(raiz, "dist", "web", "browser"));
  const extras = (env.HOSTS_PERMITIDOS ?? "").split(",").map((h) => h.trim()).filter(Boolean);

  return {
    cliente,
    porta,
    host,
    hostsPermitidos: ["localhost", "127.0.0.1", "[::1]", ...extras],
    pastaDados,
    arquivoBanco: path.join(pastaDados, cliente.banco),
    pastaCopias: path.join(pastaDados, "copias-de-seguranca"),
    pastaWeb: existsSync(path.join(pastaWeb, "index.html")) ? pastaWeb : null,
  };
}
