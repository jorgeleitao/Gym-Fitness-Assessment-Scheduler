const DIAS_SEMANA = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

export function somenteDigitos(valor: string): string {
  return (valor ?? "").replace(/\D/g, "");
}

/**
 * Normaliza um telefone brasileiro para "DDD + número" (10 ou 11 dígitos),
 * removendo espaços, parênteses, traços, código do país (+55) e zeros à esquerda.
 */
export function normalizarTelefone(valor: string): string {
  let d = somenteDigitos(valor).replace(/^0+/, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) {
    d = d.slice(2);
  }
  return d;
}

export function telefoneValido(valor: string): boolean {
  const d = normalizarTelefone(valor);
  if (d.length !== 10 && d.length !== 11) return false;
  // DDDs brasileiros vão de 11 a 99 e nunca terminam em 0.
  if (d[0] === "0" || d[1] === "0") return false;
  // Celulares com 11 dígitos começam com 9.
  if (d.length === 11 && d[2] !== "9") return false;
  return true;
}

/** Formata progressivamente: (21) 99999-9999 ou (21) 3456-7890. */
export function formatarTelefone(valor: string): string {
  const d = normalizarTelefone(valor).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  if (d.length <= 10) return `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`;
  return `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}`;
}

/** "2026-10-29" -> "29/10/2026" (sem passar por Date, para não sofrer com fuso horário). */
export function formatarData(iso: string): string {
  const [a, m, d] = iso.split("-");
  if (!a || !m || !d) return iso;
  return `${d}/${m}/${a}`;
}

function partes(iso: string): [number, number, number] {
  const [a = NaN, m = NaN, d = NaN] = iso.split("-").map(Number);
  return [a, m, d];
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Converte uma data ISO em Date ao meio-dia local (evita mudar de dia por fuso). */
export function paraDate(iso: string): Date {
  const [a, m, d] = partes(iso);
  return new Date(a, m - 1, d, 12);
}

export function diaDaSemana(iso: string): string {
  return DIAS_SEMANA[paraDate(iso).getDay()] ?? "";
}

export function hojeISO(agora: Date = new Date()): string {
  return `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`;
}

export function somarDias(iso: string, dias: number): string {
  const [a, m, d] = partes(iso);
  return hojeISO(new Date(a, m - 1, d + dias, 12));
}

export function dataValida(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [a, m, d] = partes(iso);
  const dt = new Date(a, m - 1, d, 12);
  return dt.getFullYear() === a && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function horarioValido(h: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(h);
}

export function semAcentos(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
