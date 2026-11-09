import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";

import { AppModule } from "./app.module";
import { lerConfiguracao } from "./config";
import { cabecalhosDeSeguranca, FiltroDeErros, protegerHost } from "./seguranca";

async function iniciar() {
  const config = lerConfiguracao();
  const app = await NestFactory.create<NestExpressApplication>(AppModule.com(config), {
    bodyParser: false,
    logger: ["error", "warn"],
  });

  app.disable("x-powered-by");
  app.use(protegerHost(config.hostsPermitidos));
  app.use(cabecalhosDeSeguranca);
  app.useBodyParser("json", { limit: "20kb" });
  app.useBodyParser("raw", { type: "application/octet-stream", limit: "50mb" });
  app.setGlobalPrefix("api");
  app.useGlobalFilters(new FiltroDeErros());
  if (config.pastaWeb) app.useStaticAssets(config.pastaWeb, { index: "index.html" });
  app.enableShutdownHooks();

  await app.listen(config.porta, config.host);
  const { port } = app.getHttpServer().address() as { port: number };
  const url = `http://${config.host === "0.0.0.0" ? "localhost" : config.host}:${port}`;
  console.log(`${config.cliente.produto} pronto em ${url}`);
  console.log(`Banco de dados: ${config.arquivoBanco}`);
}

iniciar().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
