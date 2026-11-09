import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests-navegador",
  globalSetup: "./tests-navegador/preparar.ts",
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
  },
});
