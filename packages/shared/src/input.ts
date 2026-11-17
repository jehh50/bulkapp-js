/**
 * Saneamiento de entrada. Equivalen a los helpers `input_*` de PHP: devuelven el
 * valor limpio, o `null` / cadena vacía cuando no es válido. El cliente los usa
 * como ayuda; el servidor los aplica siempre.
 */

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

const esEscalar = (v: unknown): v is string | number | boolean =>
  typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';

export function inputString(valor: unknown, max = 255): string {
  if (!esEscalar(valor)) return '';
  const limpio = String(valor).trim().replace(CONTROL, '');
  return max > 0 ? Array.from(limpio).slice(0, max).join('') : limpio;
}

export function inputInt(valor: unknown, min: number | null = null, max: number | null = null): number | null {
  if (!esEscalar(valor) || !/^-?\d+$/.test(String(valor).trim())) return null;
  const n = Number(String(valor).trim());
  if (!Number.isSafeInteger(n)) return null;
  if (min !== null && n < min) return null;
  if (max !== null && n > max) return null;
  return n;
}

export function inputEnum<T extends string | number>(valor: unknown, permitidos: readonly T[]): T | null {
  if (!esEscalar(valor)) return null;
  const hallado = permitidos.find((p) => String(p) === String(valor));
  return hallado === undefined ? null : hallado;
}

/** Fecha `AAAA-MM-DD` real (rechaza 2026-02-30). */
export function inputDate(valor: unknown): string | null {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const d = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor ? valor : null;
}

export function esEmail(valor: string): boolean {
  return valor.length <= 254 && EMAIL.test(valor);
}

export function inputEmail(valor: unknown, max = 150): string | null {
  const v = inputString(valor, max);
  return esEmail(v) ? v : null;
}

/** Solo letras, espacios, apóstrofo y guion. */
export function inputLetters(valor: unknown, max = 50): string {
  return inputString(valor, max).replace(/[^\p{L}\s'-]/gu, '').replace(/\s+/gu, ' ').trim();
}

export function inputDigits(valor: unknown, max = 20): string {
  if (!esEscalar(valor)) return '';
  return String(valor).replace(/\D+/g, '').slice(0, max);
}

/** Número de cuenta: hasta 20 dígitos o asteriscos (enmascarado). */
export function inputPan(valor: unknown): string | null {
  const v = inputString(valor, 20);
  return /^[0-9*]{1,20}$/.test(v) ? v : null;
}

export function inputPhone(valor: unknown, max = 20): string | null {
  const v = inputString(valor, max);
  return /^[0-9().\-\s+]+$/.test(v) ? v : null;
}

export function inputAmount(valor: unknown): string | null {
  const v = inputString(valor, 30);
  return /^[0-9.,]+$/.test(v) ? v : null;
}

export function inputIntArray(valor: unknown, maxItems = 1000): number[] {
  if (!Array.isArray(valor)) return [];
  const out: number[] = [];
  for (const item of valor.slice(0, maxItems)) {
    const n = inputInt(item, 0);
    if (n !== null) out.push(n);
  }
  return out;
}

/** Equivalente a `is_numeric()` de PHP para cadenas. */
export function esNumerico(valor: string): boolean {
  return /^\s*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(valor);
}

/** Máscara de teléfono de banca: `(0XXX)XXX.XX.XX`. */
export function mascaraTelefonoBanca(valor: string): string {
  const d = valor.replace(/\D+/g, '').slice(0, 11);
  let out = '';
  if (d.length > 0) out = `(${d.slice(0, 4)}`;
  if (d.length >= 4) out += ')';
  if (d.length > 4) out += d.slice(4, 7);
  if (d.length > 7) out += `.${d.slice(7, 9)}`;
  if (d.length > 9) out += `.${d.slice(9, 11)}`;
  return out;
}

/** Máscara de teléfono del Constructor: `(XXXX)XXX-XX-XX`. */
export function mascaraTelefonoFormulario(valor: string): string {
  return mascaraTelefonoBanca(valor).replace(/\./g, '-');
}

/** Texto apto para nombres de archivo: minúsculas, sin acentos, unido con «-». */
export function slug(texto: string, separador = '-', max = 40): string {
  const base = texto.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const limpio = base.replace(/[^a-z0-9]+/g, separador).replace(new RegExp(`^\\${separador}+|\\${separador}+$`, 'g'), '');
  return limpio.slice(0, max);
}
