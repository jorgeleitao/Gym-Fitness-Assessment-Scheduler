import { expect, hojeIso, linhas, semear, somarDias, test } from "./app";

const HOJE = hojeIso();
const situacaoDe = (page: import("@playwright/test").Page, nome: string) =>
  page.getByRole("combobox", { name: `Situação da avaliação de ${nome}` });

test("marca compareceu e faltou e atualiza o comparecimento", async ({ app, servidor }) => {
  await semear(servidor, [
    { nome: "Aline", whatsapp: "21999990001", data: HOJE, horario: "08:00" },
    { nome: "Bruno", whatsapp: "21999990002", data: HOJE, horario: "09:00" },
  ]);
  await app.reload();
  await expect(situacaoDe(app, "Aline")).toHaveValue("agendada");

  await situacaoDe(app, "Aline").selectOption("compareceu");
  await expect(app.getByText("Avaliação de Aline marcada como compareceu.")).toBeVisible();
  await expect(situacaoDe(app, "Aline")).toHaveValue("compareceu");

  await situacaoDe(app, "Bruno").selectOption("faltou");
  await expect(app.getByText("Avaliação de Bruno marcada como falta.")).toBeVisible();
  await expect(situacaoDe(app, "Bruno")).toHaveValue("faltou");
  await expect(app.getByRole("button", { name: "Enviar lembrete para Bruno" })).toBeDisabled();

  const card = app.getByRole("region", { name: "Resumo" }).getByText("Comparecimento").locator("..");
  await expect(card).toContainText("50%");
  await expect(card).toContainText("1 de 2");
  expect(servidor.linhas().map((l) => l.situacao)).toEqual(["compareceu", "faltou"]);
});

test("não deixa marcar presença em avaliação futura", async ({ app, servidor }) => {
  await semear(servidor, [{ nome: "Caio", whatsapp: "21999990003", data: somarDias(HOJE, 1), horario: "08:00" }]);
  await app.getByRole("button", { name: "Próximo dia" }).click();
  await expect(situacaoDe(app, "Caio").locator("option[value=compareceu]")).toBeDisabled();
  await expect(situacaoDe(app, "Caio").locator("option[value=faltou]")).toBeDisabled();
});

test("avaliação passada sem marcação aparece como pendente", async ({ app, servidor }) => {
  await semear(servidor, [{ nome: "Dora", whatsapp: "21999990004", data: somarDias(HOJE, -1), horario: "08:00" }]);
  await app.reload();
  await expect(app.getByRole("region", { name: "Resumo" })).toContainText("1 para marcar");
  await app.getByRole("button", { name: "Dia anterior" }).click();
  await expect(situacaoDe(app, "Dora").locator("option:checked")).toHaveText("Marcar presença");
});

test("aluno faltou e foi remarcado para outro dia", async ({ app, servidor }) => {
  await semear(servidor, [{ nome: "Elisa", whatsapp: "21999990005", data: HOJE, horario: "10:00" }]);
  await app.reload();
  await situacaoDe(app, "Elisa").selectOption("faltou");
  await expect(situacaoDe(app, "Elisa")).toHaveValue("faltou");

  await situacaoDe(app, "Elisa").selectOption("remarcar");
  // O select não fica em "Remarcar…": ele mostra a situação gravada até a remarcação terminar.
  await expect(situacaoDe(app, "Elisa")).toHaveValue("faltou");
  const dialogo = app.getByRole("dialog");
  await dialogo.getByLabel("Nova data").fill(somarDias(HOJE, -3));
  await dialogo.getByRole("button", { name: "Remarcar", exact: true }).click();
  await expect(dialogo.getByRole("alert")).toHaveText(/data futura/);

  const nova = somarDias(HOJE, 2);
  await dialogo.getByLabel("Nova data").fill(nova);
  await dialogo.getByLabel("Novo horário").fill("16:30");
  await dialogo.getByRole("button", { name: "Remarcar", exact: true }).click();
  await expect(app.getByText("Avaliação remarcada!")).toBeVisible();

  await expect(situacaoDe(app, "Elisa")).toHaveValue("agendada");
  await expect(linhas(app).filter({ hasText: "Elisa" })).toContainText("Remarcada · era");
  expect(servidor.linhas()[0]).toMatchObject({
    data_avaliacao: nova,
    horario_avaliacao: "16:30",
    situacao: "agendada",
    remarcacoes: 1,
  });
});

test("cancelar e voltar para agendada", async ({ app, servidor }) => {
  await semear(servidor, [{ nome: "Fred", whatsapp: "21999990006", data: HOJE, horario: "11:00" }]);
  await app.reload();
  await situacaoDe(app, "Fred").selectOption("cancelada");
  await expect(situacaoDe(app, "Fred")).toHaveValue("cancelada");
  const hoje = app.getByRole("region", { name: "Resumo" }).getByText("Avaliações de hoje").locator("..");
  await expect(hoje).toContainText("0");

  await situacaoDe(app, "Fred").selectOption("agendada");
  await expect(situacaoDe(app, "Fred")).toHaveValue("agendada");
});

test.describe("API", () => {
  test("valida a situação e as regras de data", async ({ request, servidor }) => {
    await semear(servidor, [{ nome: "Gabi", whatsapp: "21999990007", data: somarDias(HOJE, 1), horario: "10:00" }]);
    const url = `${servidor.url}/api/avaliacoes/${servidor.linhas()[0]?.id}`;

    const invalida = await request.patch(`${url}/situacao`, { data: { situacao: "presente", hoje: HOJE } });
    expect(invalida.status()).toBe(400);
    const futura = await request.patch(`${url}/situacao`, { data: { situacao: "compareceu", hoje: HOJE } });
    expect(futura.status()).toBe(422);
    const passado = await request.post(`${url}/remarcar`, { data: { data: "2020-01-01", horario: "10:00", hoje: HOJE } });
    expect(passado.status()).toBe(422);
    const horario = await request.post(`${url}/remarcar`, { data: { data: HOJE, horario: "25:00", hoje: HOJE } });
    expect(horario.status()).toBe(422);
    const inexistente = await request.patch(`${servidor.url}/api/avaliacoes/nao-existe/situacao`, {
      data: { situacao: "cancelada", hoje: HOJE },
    });
    expect(inexistente.status()).toBe(404);
    expect(servidor.linhas()[0]).toMatchObject({ situacao: "agendada", remarcacoes: 0 });
  });
});

test("remarcação recusada pelo servidor não muda o select", async ({ app, servidor }) => {
  await semear(servidor, [{ nome: "Hana", whatsapp: "21999990008", data: HOJE, horario: "10:00" }]);
  await app.reload();
  await situacaoDe(app, "Hana").selectOption("remarcar");
  await app.getByRole("dialog").getByRole("button", { name: "Remarcar", exact: true }).click();
  await expect(app.getByRole("dialog").getByRole("alert")).toHaveText(/diferente do atual/);
  await app.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();
  await expect(situacaoDe(app, "Hana")).toHaveValue("agendada");
  expect(servidor.linhas()[0]).toMatchObject({ remarcacoes: 0 });
});
