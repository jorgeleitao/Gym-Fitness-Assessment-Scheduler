// Gera prints com dados fictícios. Não faz parte da suíte: rode com
//   CAPTURAS=<pasta> npx playwright test capturas
import path from "node:path";

import { expect, hojeIso, linhas, novaAvaliacao, semear, type Servidor, somarDias, test } from "./app";

const PASTA = process.env.CAPTURAS;
test.skip(!PASTA, "defina CAPTURAS=<pasta> para gerar os prints");
test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

const HOJE = hojeIso();
const arquivo = (nome: string) => path.join(PASTA ?? "", nome);
const semAvisos = (page: import("@playwright/test").Page) =>
  expect(page.locator("[data-aviso]")).toHaveCount(0, { timeout: 20_000 });

async function marcar(servidor: Servidor, nome: string, situacao: string) {
  const db = servidor.linhas().find((l) => l.nome === nome);
  await fetch(`${servidor.url}/api/avaliacoes/${db?.id}/situacao`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ situacao, hoje: HOJE }),
  });
}

async function remarcar(servidor: Servidor, nome: string, data: string, horario: string) {
  const db = servidor.linhas().find((l) => l.nome === nome);
  await fetch(`${servidor.url}/api/avaliacoes/${db?.id}/remarcar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data, horario, hoje: HOJE }),
  });
}

test("prints", async ({ app, servidor }) => {
  test.setTimeout(180_000);
  await semear(servidor, [
    { nome: "Mariana Costa", whatsapp: "21987651234", data: HOJE, horario: "07:30" },
    { nome: "Rafael Nogueira", whatsapp: "11998762345", data: HOJE, horario: "09:00" },
    { nome: "Beatriz Almeida", whatsapp: "31991237654", data: HOJE, horario: "12:15" },
    { nome: "Thiago Moreira", whatsapp: "21976543210", data: HOJE, horario: "18:40" },
    { nome: "Camila Rocha", whatsapp: "21965432109", data: somarDias(HOJE, 1), horario: "08:00" },
    { nome: "Lucas Ferreira", whatsapp: "11954321098", data: somarDias(HOJE, 2), horario: "19:00" },
    { nome: "Camila Duarte", whatsapp: "21943210987", data: somarDias(HOJE, 5), horario: "10:30" },
    { nome: "Pedro Henrique", whatsapp: "21932109876", data: somarDias(HOJE, -2), horario: "17:00" },
    { nome: "Fernanda Lima", whatsapp: "21921098765", data: somarDias(HOJE, -2), horario: "07:00" },
    { nome: "Gustavo Ramos", whatsapp: "21910987654", data: somarDias(HOJE, -2), horario: "08:30" },
    { nome: "Helena Souza", whatsapp: "21909876543", data: somarDias(HOJE, -3), horario: "18:00" },
    { nome: "Igor Batista", whatsapp: "21998765432", data: somarDias(HOJE, -5), horario: "06:30" },
  ]);
  await marcar(servidor, "Mariana Costa", "compareceu");
  await marcar(servidor, "Rafael Nogueira", "compareceu");
  await marcar(servidor, "Fernanda Lima", "compareceu");
  await marcar(servidor, "Gustavo Ramos", "faltou");
  await marcar(servidor, "Helena Souza", "compareceu");
  await marcar(servidor, "Igor Batista", "compareceu");
  await remarcar(servidor, "Thiago Moreira", HOJE, "19:30");
  await app.reload();
  await expect(linhas(app)).toHaveCount(4);
  await app.screenshot({ path: arquivo("01-painel-do-dia.png") });

  await novaAvaliacao(app).click();
  await app.locator("#campo-nome").fill("Juliana Martins");
  await app.locator("#campo-data").fill(somarDias(HOJE, 1));
  await app.locator("#campo-horario").fill("06:45");
  await app.locator("#campo-whatsapp").pressSequentially("21988776655");
  await app.locator("#campo-nome").focus();
  await app.screenshot({ path: arquivo("02-nova-avaliacao.png") });

  await app.locator("#campo-nome").fill("J");
  await app.locator("#campo-whatsapp").fill("1234");
  await app.getByRole("button", { name: "Salvar avaliação" }).click();
  await app.screenshot({ path: arquivo("03-validacao-do-formulario.png") });
  await app.getByRole("button", { name: "Cancelar" }).click();

  await app.getByRole("combobox", { name: "Situação da avaliação de Beatriz Almeida" }).selectOption("remarcar");
  await app.getByRole("dialog").getByLabel("Nova data").fill(somarDias(HOJE, 1));
  await app.getByRole("dialog").getByLabel("Novo horário").fill("17:00");
  await app.screenshot({ path: arquivo("04-remarcar-avaliacao.png") });
  await app.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();

  await app.getByRole("button", { name: "Enviar lembrete para Beatriz Almeida" }).click();
  await expect(app.getByText("Abrindo o WhatsApp…")).toBeVisible();
  await app.screenshot({ path: arquivo("05-lembrete-whatsapp.png") });
  await semAvisos(app);

  await app.getByLabel("Buscar por nome ou telefone").fill("camila");
  await expect(linhas(app)).toHaveCount(2);
  await app.screenshot({ path: arquivo("06-busca-em-todas-as-datas.png") });
  await app.getByRole("button", { name: "Limpar busca" }).first().click();

  await app.getByRole("button", { name: "Escolher data no calendário" }).click();
  await app.screenshot({ path: arquivo("07-calendario.png") });
  await app.keyboard.press("Escape");

  await app.getByRole("button", { name: "Backup" }).click();
  await app.screenshot({ path: arquivo("08-menu-de-backup.png") });
  const [download] = await Promise.all([
    app.waitForEvent("download"),
    app.getByRole("menuitem", { name: /Fazer backup/ }).click(),
  ]);
  await semAvisos(app);
  await app.getByTestId("arquivo-backup").setInputFiles(await download.path());
  await expect(app.getByRole("button", { name: "Restaurar e substituir" })).toBeVisible();
  await app.screenshot({ path: arquivo("09-restaurar-backup.png") });
  await app.getByRole("button", { name: "Cancelar" }).click();

  await app.getByRole("button", { name: "Dia anterior" }).click();
  await app.getByRole("button", { name: "Dia anterior" }).click();
  await expect(linhas(app)).toHaveCount(3);
  await app.screenshot({ path: arquivo("10-dia-passado-com-presencas.png") });

  await app.getByRole("button", { name: "Hoje", exact: true }).click();
  await app.setViewportSize({ width: 1280, height: 760 });
  await app.screenshot({ path: path.resolve(import.meta.dirname, "../docs/imagens/painel.png"), scale: "css" });

  await app.setViewportSize({ width: 390, height: 844 });
  await app.screenshot({ path: arquivo("12-celular.png"), fullPage: true });
});
