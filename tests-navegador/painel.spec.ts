import { MENSAGENS_PADRAO } from "../scripts/cliente-config.mjs";
import { cadastrar, expect, hojeIso, linhas, novaAvaliacao, semear, somarDias, test } from "./app";

const HOJE = hojeIso();
const nomes = (page: import("@playwright/test").Page) => linhas(page).locator("td:first-child span.font-semibold");

test("abre no dia atual com o estado vazio de hoje", async ({ app, servidor }) => {
  await semear(servidor, [{ nome: "Futuro", whatsapp: "21999999999", data: somarDias(HOJE, 4), horario: "10:00" }]);
  await app.reload();
  await expect(app.getByText("Ops! Cadê as avaliações de hoje? 👀")).toBeVisible();
  await expect(app.getByTestId("estado-vazio").getByRole("button", { name: "Nova Avaliação" })).toBeVisible();
  await expect(linhas(app)).toHaveCount(0);
});

test("lista só a data selecionada, por horário, e navega entre os dias", async ({ app, servidor }) => {
  await semear(servidor, [
    { nome: "Bruno", whatsapp: "21999990002", data: HOJE, horario: "15:00" },
    { nome: "Ana", whatsapp: "21999990001", data: HOJE, horario: "08:30" },
    { nome: "Carla", whatsapp: "21999990003", data: somarDias(HOJE, 1), horario: "09:00" },
  ]);
  await app.reload();
  await expect(nomes(app)).toHaveText(["Ana", "Bruno"]);

  await app.getByRole("button", { name: "Próximo dia" }).click();
  await expect(nomes(app)).toHaveText(["Carla"]);

  await app.getByRole("button", { name: "Próximo dia" }).click();
  await expect(app.getByText("Agenda livre por aqui!")).toBeVisible();

  await app.getByRole("button", { name: "Hoje", exact: true }).click();
  await expect(nomes(app)).toHaveText(["Ana", "Bruno"]);
});

test("calendário escolhe a data", async ({ app, servidor }) => {
  const alvo = somarDias(HOJE, 3);
  await semear(servidor, [{ nome: "Daniel", whatsapp: "21999990004", data: alvo, horario: "09:00" }]);
  await app.getByRole("button", { name: "Escolher data no calendário" }).click();
  const rotulo = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(new Date(`${alvo}T12:00:00`));
  // Se a data cair no mês seguinte, avança o calendário.
  if (!(await app.getByRole("button", { name: rotulo }).isVisible())) {
    await app.getByRole("button", { name: "Próximo mês" }).click();
  }
  await app.getByRole("button", { name: rotulo }).click();
  await expect(nomes(app)).toHaveText(["Daniel"]);
});

test("indicadores refletem o banco", async ({ app, servidor }) => {
  await semear(servidor, [
    { nome: "Ana", whatsapp: "21999990001", data: HOJE, horario: "08:30" },
    { nome: "Carla", whatsapp: "21999990003", data: somarDias(HOJE, 1), horario: "09:00" },
    { nome: "Davi", whatsapp: "21999990004", data: somarDias(HOJE, 30), horario: "09:00" },
  ]);
  await app.reload();
  const resumo = app.getByRole("region", { name: "Resumo" });
  await expect(resumo.getByText("Avaliações de hoje").locator("..")).toContainText("1");
  await expect(resumo.getByText("Avaliações futuras").locator("..")).toContainText("2");
});

test("Enviar lembrete abre o WhatsApp com o nome e o telefone daquela linha", async ({ app, servidor }) => {
  await semear(servidor, [
    { nome: "João da Silva", whatsapp: "(21) 99999-9999", data: HOJE, horario: "15:30" },
    { nome: "Maria Souza", whatsapp: "(11) 98765-4321", data: HOJE, horario: "09:00" },
  ]);
  await app.reload();

  await app.getByRole("button", { name: "Enviar lembrete para João da Silva" }).click();
  await expect.poll(() => servidor.links.length).toBe(1);
  expect(servidor.links[0]).toMatch(/^https:\/\/wa\.me\/5521999999999\?text=/);
  expect(decodeURIComponent(servidor.links[0]!.split("?text=")[1]!)).toBe(
    MENSAGENS_PADRAO.hoje.replace("{{nome}}", "João da Silva").replace("{{horario}}", "15:30"),
  );

  await app.getByRole("button", { name: "Enviar lembrete para Maria Souza" }).click();
  await expect.poll(() => servidor.links.length).toBe(2);
  expect(servidor.links[1]).toMatch(/^https:\/\/wa\.me\/5511987654321\?text=/);
  expect(decodeURIComponent(servidor.links[1]!)).toContain("Olá, Maria Souza!");
});

test("lembrete fica desabilitado para avaliações passadas", async ({ app, servidor }) => {
  await semear(servidor, [{ nome: "Zé", whatsapp: "21999990003", data: somarDias(HOJE, -1), horario: "07:00" }]);
  await app.getByRole("button", { name: "Dia anterior" }).click();
  await expect(app.getByRole("button", { name: "Enviar lembrete para Zé" })).toBeDisabled();
});

test("cadastra, edita e exclui (com confirmação)", async ({ app, servidor }) => {
  await expect(app.getByText("Ops! Cadê as avaliações de hoje? 👀")).toBeVisible();

  await novaAvaliacao(app).click();
  const dialogo = app.getByRole("dialog");
  await dialogo.getByRole("button", { name: "Salvar avaliação" }).click();
  await expect(dialogo.getByText("Informe o nome do cliente.")).toBeVisible();
  await expect(app.locator("#campo-nome")).toBeFocused();

  await dialogo.getByLabel("Nome do cliente").fill("Lívia Araújo");
  await dialogo.getByLabel("Horário").fill("14:45");
  await dialogo.getByLabel("WhatsApp com DDD").pressSequentially("21987654321");
  await expect(dialogo.getByLabel("WhatsApp com DDD")).toHaveValue("(21) 98765-4321");
  await dialogo.getByRole("button", { name: "Salvar avaliação" }).click();
  await expect(nomes(app)).toHaveText(["Lívia Araújo"]);

  await app.getByRole("button", { name: "Editar avaliação de Lívia Araújo" }).click();
  await app.getByRole("dialog").getByLabel("Nome do cliente").fill("Lívia A. Santos");
  await app.getByRole("dialog").getByRole("button", { name: "Salvar avaliação" }).click();
  await expect(nomes(app)).toHaveText(["Lívia A. Santos"]);
  expect(servidor.linhas()).toHaveLength(1);

  await app.getByRole("button", { name: "Excluir avaliação de Lívia A. Santos" }).click();
  await app.getByRole("button", { name: "Cancelar" }).click();
  await expect(linhas(app)).toHaveCount(1);
  await app.getByRole("button", { name: "Excluir avaliação de Lívia A. Santos" }).click();
  await app.getByRole("button", { name: "Sim, excluir" }).click();
  await expect(app.getByText("Ops! Cadê as avaliações de hoje? 👀")).toBeVisible();
  expect(servidor.linhas()).toHaveLength(0);
});

test("busca por nome (sem acento) e por telefone em todas as datas", async ({ app, servidor }) => {
  await semear(servidor, [
    { nome: "Álvaro", whatsapp: "21912345678", data: somarDias(HOJE, 7), horario: "10:00" },
    { nome: "Bruna", whatsapp: "21999990002", data: HOJE, horario: "11:00" },
  ]);
  const campo = app.getByLabel("Buscar por nome ou telefone");
  await campo.fill("alvaro");
  await expect(nomes(app)).toHaveText(["Álvaro"]);

  await campo.fill("99990002");
  await expect(nomes(app)).toHaveText(["Bruna"]);

  await campo.fill("ninguem");
  await expect(app.getByText("Ninguém encontrado")).toBeVisible();
});

test("backup pelo menu: baixa, restaura e pede confirmação", async ({ app, servidor }) => {
  await cadastrar(app, { nome: "Paula Reis", whatsapp: "21999990001" });
  await expect(nomes(app)).toHaveText(["Paula Reis"]);

  await app.getByRole("button", { name: "Backup" }).click();
  const [download] = await Promise.all([
    app.waitForEvent("download"),
    app.getByRole("menuitem", { name: /Fazer backup/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^forja-backup-.+\.db$/);
  const arquivo = await download.path();

  await app.getByRole("button", { name: "Excluir avaliação de Paula Reis" }).click();
  await app.getByRole("button", { name: "Sim, excluir" }).click();
  await expect(linhas(app)).toHaveCount(0);

  await app.getByTestId("arquivo-backup").setInputFiles(arquivo);
  await expect(app.getByText(/O backup contém\s+1\s+avaliação/)).toBeVisible();
  await app.getByRole("button", { name: "Restaurar e substituir" }).click();
  await expect(app.getByText("Backup restaurado!")).toBeVisible();
  await expect(nomes(app)).toHaveText(["Paula Reis"]);
  expect(servidor.linhas()).toHaveLength(1);
});
