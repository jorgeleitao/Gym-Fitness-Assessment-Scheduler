// Tipos de cliente-config.mjs.
export interface Cliente {
  id: string;
  pasta: string;
  nome: string;
  nomeCurto: string;
  produto: string;
  executavel: string;
  identificador: string;
  banco: string;
  prefixoBackup: string;
  versao: string;
  logo: string;
  icone: string;
  caminhoLogo: string;
  caminhoIcone: string;
  mensagens: { hoje: string; futura: string };
  cores: Record<"primaria" | "barraTopo" | "primariaSuave" | "primariaTexto" | "primariaContraste", string>;
}
export const RAIZ: string;
export const PASTA_CLIENTES: string;
export const CLIENTE_PADRAO: string;
export const MENSAGENS_PADRAO: { hoje: string; futura: string };
export function clienteAtual(): string;
export function listarClientes(): string[];
export function validarCliente(c: unknown, pasta?: string): string[];
export function carregarCliente(id?: string): Cliente;
export function carregarClienteDaPasta(pasta: string, id?: string): Cliente;
export function cssDaMarca(cliente: Cliente): string;
export function preencherModelo(modelo: string, cliente: Cliente): string;
