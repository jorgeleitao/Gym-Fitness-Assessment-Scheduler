// Cada teste sobe a API real (dist/api/main.cjs, que também serve o build do Angular)
// numa porta livre e com um banco SQLite próprio numa pasta temporária.
import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { test as base, expect, type Page } from "@playwright/test";

const RAIZ = path.resolve(import.meta.dirname, "..");

export interface Servidor {
  url: string;
  pastaDados: string;
  /** Links que o app tentou abrir em outra aba (WhatsApp). */
  links: string[];
  linhas(): Record<string, unknown>[];
}

async function iniciarServidor(): Promise<{ servidor: Servidor; parar: () => void }> {
  const pastaDados = mkdtempSync(path.join(tmpdir(), "painel-e2e-"));
  const processo: ChildProcess = spawn(process.execPath, ["dist/api/main.cjs"], {
    cwd: RAIZ,
    env: { ...process.env, PORTA: "0", DADOS_DIR: pastaDados, CLIENTE: "forja" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const url = await new Promise<string>((resolve, reject) => {
    let saida = "";
    const tempo = setTimeout(() => reject(new Error(`API não subiu:\n${saida}`)), 15_000);
    const ler = (b: Buffer) => {
      saida += b.toString();
      const m = /pronto em (http:\/\/\S+)/.exec(saida);
      if (m?.[1]) {
        clearTimeout(tempo);
        resolve(m[1]);
      }
    };
    processo.stdout?.on("data", ler);
    processo.stderr?.on("data", ler);
    processo.on("exit", (c) => reject(new Error(`API saiu com código ${c}:\n${saida}`)));
  });

  const servidor: Servidor = {
    url,
    pastaDados,
    links: [],
    linhas() {
      const db = new DatabaseSync(path.join(pastaDados, "forja.db"), { readOnly: true });
      try {
        return db.prepare("SELECT * FROM avaliacoes ORDER BY data_avaliacao, horario_avaliacao").all();
      } finally {
        db.close();
      }
    },
  };
  return {
    servidor,
    parar: () => {
      processo.kill();
      rmSync(pastaDados, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    },
  };
}

export const test = base.extend<{ servidor: Servidor; app: Page }>({
  servidor: async ({}, use) => {
    const { servidor, parar } = await iniciarServidor();
    await use(servidor);
    parar();
  },
  app: async ({ page, context, servidor }, use) => {
    // O WhatsApp abre em outra aba; aqui só registramos o endereço, sem acessar a internet.
    await context.route(/^https:\/\/(api\.)?wa\.me\//, (rota) => {
      servidor.links.push(rota.request().url());
      return rota.fulfill({ contentType: "text/html", body: "<title>WhatsApp (teste)</title>" });
    });
    await page.goto(servidor.url);
    await expect(novaAvaliacao(page)).toBeVisible();
    await use(page);
  },
});

export { expect };

export const novaAvaliacao = (page: Page) =>
  page.getByRole("banner").getByRole("button", { name: "Nova Avaliação" });

export const linhas = (page: Page) => page.getByTestId("linha-avaliacao");

export function hojeIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export async function cadastrar(
  page: Page,
  dados: { nome: string; whatsapp: string; data?: string; horario?: string },
) {
  await novaAvaliacao(page).click();
  await page.locator("#campo-nome").fill(dados.nome);
  await page.locator("#campo-data").fill(dados.data ?? hojeIso());
  await page.locator("#campo-horario").fill(dados.horario ?? "10:00");
  await page.locator("#campo-whatsapp").fill(dados.whatsapp);
  await page.getByRole("button", { name: "Salvar avaliação" }).click();
}

/** Cadastra direto pela API (mais rápido para preparar cenários). */
export async function semear(
  servidor: Servidor,
  registros: { nome: string; whatsapp: string; data: string; horario: string }[],
) {
  for (const r of registros) {
    const resposta = await fetch(`${servidor.url}/api/avaliacoes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(r),
    });
    if (!resposta.ok) throw new Error(await resposta.text());
  }
}
