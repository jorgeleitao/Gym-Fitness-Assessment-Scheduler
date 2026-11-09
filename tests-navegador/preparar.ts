import { execSync } from "node:child_process";
import path from "node:path";

/** Gera o build do Angular e da API uma vez antes de todos os testes. */
export default function preparar() {
  if (process.env.PULAR_BUILD) return;
  execSync("npm run build", { cwd: path.resolve(import.meta.dirname, ".."), stdio: "inherit" });
}
