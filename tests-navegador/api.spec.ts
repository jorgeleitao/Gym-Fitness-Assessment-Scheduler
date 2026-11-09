import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { request as http } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { expect, hojeIso, semear, test } from "./app";

const MIGRATION = readFileSync(path.resolve(import.meta.dirname, "../api/migrations/0001_criar_avaliacoes.sql"), "utf8");

/** Gera um arquivo .db com o conteúdo que o teste quiser (para simular backups adulterados). */
function bancoFalso(montar: (db: DatabaseSync) => void): Buffer {
  const pasta = mkdtempSync(path.join(tmpdir(), "painel-falso-"));
  const arquivo = path.join(pasta, "falso.db");
  const db = new DatabaseSync(arquivo);
  montar(db);
  db.close();
  const conteudo = readFileSync(arquivo);
  rmSync(pasta, { recursive: true, force: true });
  return conteudo;
}

function comHost(url: string, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http(`${url}/api/cliente`, { headers: { Host: host } }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on("error", reject);
    req.end();
  });
}

const valida = { nome: "Ana Lima", whatsapp: "21999999999", data: hojeIso(), horario: "10:00" };

test.describe("API: acesso", () => {
  test("recusa Host de outro domínio (DNS rebinding)", async ({ servidor }) => {
    expect(await comHost(servidor.url, "site-malicioso.com")).toBe(403);
    expect(await comHost(servidor.url, "localhost")).toBe(200);
  });

  test("não libera CORS para outras origens", async ({ request, servidor }) => {
    const r = await request.get(`${servidor.url}/api/avaliacoes?data=${hojeIso()}`, {
      headers: { Origin: "https://site-malicioso.com" },
    });
    expect(r.headers()["access-control-allow-origin"]).toBeUndefined();

    const preflight = await request.fetch(`${servidor.url}/api/avaliacoes/x`, {
      method: "OPTIONS",
      headers: { Origin: "https://site-malicioso.com", "Access-Control-Request-Method": "DELETE" },
    });
    expect(preflight.headers()["access-control-allow-origin"]).toBeUndefined();
  });

  test("envia cabeçalhos de segurança", async ({ request, servidor }) => {
    const h = (await request.get(`${servidor.url}/api/cliente`)).headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("não serve arquivos fora do build do front", async ({ request, servidor }) => {
    for (const caminho of ["/..%2f..%2fpackage.json", "/%2e%2e/%2e%2e/package.json", "/api/../package.json"]) {
      const r = await request.get(servidor.url + caminho);
      expect(await r.text()).not.toContain('"name": "painel-avaliacoes"');
    }
  });
});

test.describe("API: entrada de dados", () => {
  test("SQL na busca e nos campos é tratado como texto", async ({ request, servidor }) => {
    await semear(servidor, [valida, { ...valida, nome: "Bruno Dias", whatsapp: "21988887777" }]);
    const busca = await request.get(`${servidor.url}/api/avaliacoes`, { params: { busca: "' OR '1'='1" } });
    expect(await busca.json()).toEqual([]);

    const r = await request.post(`${servidor.url}/api/avaliacoes`, {
      data: { ...valida, nome: "x'); DELETE FROM avaliacoes; --" },
    });
    expect(r.status()).toBe(201);
    expect(servidor.linhas()).toHaveLength(3);
  });

  test("campos extras e tipos errados não passam", async ({ request, servidor }) => {
    const extra = await request.post(`${servidor.url}/api/avaliacoes`, {
      data: { ...valida, id: "escolhido-pelo-cliente", criadoEm: "1999-01-01" },
    });
    expect(extra.status()).toBe(201);
    const [linha] = servidor.linhas();
    expect(linha?.id).not.toBe("escolhido-pelo-cliente");
    expect(linha?.criado_em).not.toBe("1999-01-01");

    const tipos = await request.post(`${servidor.url}/api/avaliacoes`, {
      data: { nome: ["Ana", "Lima"], whatsapp: 21999999999, data: {}, horario: null },
    });
    expect(tipos.status()).toBe(400);
  });

  test("parâmetros inválidos retornam 400 sem detalhes internos", async ({ request, servidor }) => {
    const casos = [
      request.get(`${servidor.url}/api/avaliacoes?data=2026-02-31`),
      request.get(`${servidor.url}/api/avaliacoes/contadores?hoje=ontem`),
      request.put(`${servidor.url}/api/avaliacoes/..%2F..%2Fetc`, { data: valida }),
      request.delete(`${servidor.url}/api/avaliacoes/${"a".repeat(100)}`),
      request.post(`${servidor.url}/api/avaliacoes/abc/lembrete`, { data: { hoje: "x" } }),
    ];
    for (const r of await Promise.all(casos)) {
      expect(r.status()).toBe(400);
      const corpo = await r.json();
      expect(Object.keys(corpo)).toEqual(["mensagem"]);
      expect(JSON.stringify(corpo)).not.toMatch(/at \w+ \(|node_modules|\.ts:/);
    }
  });

  test("corpo JSON grande demais é recusado", async ({ request, servidor }) => {
    const r = await request.post(`${servidor.url}/api/avaliacoes`, {
      data: { ...valida, nome: "x".repeat(50_000) },
    });
    expect(r.status()).toBe(413);
    expect(servidor.linhas()).toHaveLength(0);
  });

  test("lembrete de avaliação inexistente ou passada não gera link", async ({ request, servidor }) => {
    await semear(servidor, [{ ...valida, data: "2020-01-01" }]);
    const [passada] = servidor.linhas();
    const r1 = await request.post(`${servidor.url}/api/avaliacoes/${passada?.id}/lembrete`, { data: { hoje: hojeIso() } });
    expect(r1.status()).toBe(422);
    const r2 = await request.post(`${servidor.url}/api/avaliacoes/nao-existe/lembrete`, { data: { hoje: hojeIso() } });
    expect(r2.status()).toBe(422);
  });
});

test.describe("API: backup e restauração", () => {
  const restaurar = (url: string, request: import("@playwright/test").APIRequestContext, arquivo: Buffer) =>
    request.post(`${url}/api/backup/restaurar`, {
      data: arquivo,
      headers: { "Content-Type": "application/octet-stream" },
    });

  test("backup baixado restaura os dados e guarda cópia dos anteriores", async ({ request, servidor }) => {
    await semear(servidor, [valida]);
    const backup = await request.get(`${servidor.url}/api/backup`);
    expect(backup.headers()["content-disposition"]).toMatch(/attachment; filename="forja-backup-.+\.db"/);
    const arquivo = await backup.body();

    await semear(servidor, [{ ...valida, nome: "Depois do backup", whatsapp: "21988887777" }]);
    expect(servidor.linhas()).toHaveLength(2);

    const r = await restaurar(servidor.url, request, arquivo);
    expect(r.status()).toBe(200);
    expect((await r.json()).total).toBe(1);
    expect(servidor.linhas().map((l) => l.nome)).toEqual(["Ana Lima"]);
    expect(readdirSync(path.join(servidor.pastaDados, "copias-de-seguranca"))).toHaveLength(1);
  });

  test("restaura backup da versão antiga (sem situação) como agendadas", async ({ request, servidor }) => {
    const antigo = bancoFalso((db) => {
      db.exec(MIGRATION);
      db.exec(
        `INSERT INTO avaliacoes VALUES ('a1','Ana Antiga','ana antiga','21999999999','${hojeIso()}','10:00','2026-01-01T00:00:00Z','2026-01-01T00:00:00Z')`,
      );
    });
    const r = await restaurar(servidor.url, request, antigo);
    expect(r.status()).toBe(200);
    expect(servidor.linhas()[0]).toMatchObject({ nome: "Ana Antiga", situacao: "agendada", remarcacoes: 0, remarcada_de: null });
  });

  test("recusa backup com situação inválida", async ({ request, servidor }) => {
    const arquivo = bancoFalso((db) => {
      db.exec(
        "CREATE TABLE avaliacoes (id, nome, nome_busca, whatsapp, data_avaliacao, horario_avaliacao, criado_em, atualizado_em, situacao, remarcacoes, remarcada_de)",
      );
      db.exec(`INSERT INTO avaliacoes VALUES ('1','Ana','ana','21999999999','${hojeIso()}','10:00','','','sumiu',0,NULL)`);
    });
    const r = await restaurar(servidor.url, request, arquivo);
    expect(r.status()).toBe(422);
    expect((await r.json()).mensagem).toMatch(/registro inválido/);
  });

  const adulterados: [string, () => Buffer, RegExp][] = [
    ["arquivo que não é SQLite", () => Buffer.from("isto não é um banco de dados"), /não é um banco de dados SQLite/],
    ["SQLite sem a tabela", () => bancoFalso((db) => db.exec("CREATE TABLE outra (x)")), /tabela não encontrada/],
    [
      "tabela trocada por uma view",
      () =>
        bancoFalso((db) =>
          db.exec(
            "CREATE TABLE t (id, nome, nome_busca, whatsapp, data_avaliacao, horario_avaliacao, criado_em, atualizado_em); CREATE VIEW avaliacoes AS SELECT * FROM t",
          ),
        ),
      /tabela não encontrada/,
    ],
    [
      "registro inválido",
      () =>
        bancoFalso((db) => {
          db.exec(MIGRATION.replace(/CHECK \([^\n]*\)\)?/g, ""));
          db.exec("INSERT INTO avaliacoes VALUES ('1','<script>','x','abc','2026-02-31','99:99','','')");
        }),
      /registro inválido/,
    ],
  ];

  for (const [nome, gerar, erro] of adulterados) {
    test(`recusa ${nome} sem mexer nos dados`, async ({ request, servidor }) => {
      await semear(servidor, [valida]);
      const r = await restaurar(servidor.url, request, gerar());
      expect(r.status()).toBe(422);
      expect((await r.json()).mensagem).toMatch(erro);
      expect(servidor.linhas()).toHaveLength(1);
    });
  }

  test("restauração sem arquivo ou com tipo errado é recusada", async ({ request, servidor }) => {
    const vazio = await restaurar(servidor.url, request, Buffer.alloc(0));
    expect(vazio.status()).toBe(400);
    const json = await request.post(`${servidor.url}/api/backup/restaurar`, { data: { caminho: "C:\\Windows\\x.db" } });
    expect(json.status()).toBe(400);
  });
});
