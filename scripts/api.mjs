// Empacota a API NestJS num único arquivo (dist/api/main.cjs) com esbuild.
//
//   node scripts/api.mjs build           build para produção
//   node scripts/api.mjs dev             recompila e reinicia a cada alteração
//   node scripts/api.mjs build --sidecar inclui as dependências (versão desktop, dist/api-desktop)
import { spawn } from "node:child_process";
import path from "node:path";

import * as esbuild from "esbuild";

const raiz = path.resolve(import.meta.dirname, "..");
const [modo = "build", ...flags] = process.argv.slice(2);
const sidecar = flags.includes("--sidecar");
const saida = path.join(raiz, "dist", sidecar ? "api-desktop" : "api", "main.cjs");

// Módulos opcionais que o Nest tenta carregar só quando são usados.
const OPCIONAIS = [
  "@nestjs/microservices",
  "@nestjs/microservices/microservices-module",
  "@nestjs/websockets",
  "@nestjs/websockets/socket-module",
  "class-validator",
  "class-transformer",
  "class-transformer/storage",
  "@fastify/static",
];

const opcoes = {
  entryPoints: [path.join(raiz, "api", "src", "main.ts")],
  outfile: saida,
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  sourcemap: !sidecar,
  tsconfig: path.join(raiz, "api", "tsconfig.json"),
  loader: { ".sql": "text" },
  packages: sidecar ? undefined : "external",
  external: sidecar ? OPCIONAIS : [],
  define: { "import.meta.dirname": "undefined" },
  logLevel: "warning",
};

if (modo === "build") {
  await esbuild.build(opcoes);
  console.log(`API: ${path.relative(raiz, saida)}`);
} else if (modo === "dev") {
  let processo;
  const reiniciar = {
    name: "reiniciar",
    setup(build) {
      build.onEnd((r) => {
        if (r.errors.length) return;
        processo?.kill();
        processo = spawn(process.execPath, ["--enable-source-maps", saida], { stdio: "inherit" });
      });
    },
  };
  const ctx = await esbuild.context({ ...opcoes, plugins: [reiniciar] });
  await ctx.watch();
} else {
  console.error(`modo desconhecido: ${modo}`);
  process.exit(1);
}
