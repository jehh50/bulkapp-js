/**
 * Formularios dinámicos del Constructor: definición (`formulario_versiones.definicion`)
 * y validación de los valores capturados. Lo usan el editor y la captura (web) y,
 * siempre, el servidor: nunca se confía en lo que llega del cliente.
 */
import { CAPTURA_MAX_VALOR, TIPOS_CAMPO, TRANSFORMACION, TRANSFORMACIONES, type TipoCampo } from './constants.ts';
import { esEmail, esNumerico, inputDate } from './input.ts';

export interface NodoArbol { p: string; c: string }
export interface Condicion { k: string; v: string }

export interface CampoDef {
  k: string;
  type: TipoCampo;
  label: string;
  placeholder?: string;
  help?: string;
  req?: boolean;
  min?: number;
  max?: number;
  /** Clave del catálogo `formulario_expresiones`. */
  expr?: string;
  /** Patrón congelado en la versión al guardar. */
  regex?: string;
  transform?: string;
  cond?: Condicion;
  opts?: string[];
  tree?: NodoArbol[];
  lv1?: string;
  lv2?: string;
}
export interface Definicion { campos: CampoDef[] }

export interface ExpresionCatalogo {
  clave: string;
  patron: string | null;
  transformacion: string | null;
  tipos: string;
}
interface ExpresionIndexada { regex: string | null; transform: string | null; tipos: string[] }

export type ValorCampo = string | { lv1: string; lv2: string };
export type Valores = Record<string, ValorCampo>;

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const texto = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

export function indexarExpresiones(filas: ExpresionCatalogo[]): Record<string, ExpresionIndexada> {
  const indice: Record<string, ExpresionIndexada> = {};
  for (const f of filas) {
    if (!f.clave) continue;
    indice[f.clave] = {
      regex: f.patron ? f.patron : null,
      transform: f.transformacion ? f.transformacion : null,
      tipos: f.tipos.split(',').map((t) => t.trim()).filter(Boolean),
    };
  }
  return indice;
}

/** Compila un patrón del catálogo; null si no es una expresión válida. */
export function compilarPatron(patron: string): RegExp | null {
  try {
    return new RegExp(patron, 'u');
  } catch {
    return null;
  }
}

export function hijosDeNodo(nodo: NodoArbol): string[] {
  return nodo.c.split(',').map((h) => h.trim()).filter(Boolean);
}

/** Valida y normaliza una definición de formulario. */
export function validarDefinicion(
  definicion: unknown,
  expresiones: Record<string, ExpresionIndexada> = {},
): { ok: boolean; errores: string[]; definicion: Definicion } {
  if (!esObjeto(definicion) || !Array.isArray(definicion.campos)) {
    return { ok: false, errores: ['La definición debe contener una lista de campos.'], definicion: { campos: [] } };
  }

  const errores: string[] = [];
  const campos = definicion.campos as unknown[];
  if (campos.length === 0) errores.push('El formulario debe tener al menos un campo.');

  const vistas = new Set<string>();
  const normalizados: CampoDef[] = [];

  campos.forEach((campo, i) => {
    const pos = i + 1;
    if (!esObjeto(campo)) {
      errores.push(`Campo #${pos}: estructura inválida.`);
      return;
    }

    const k = texto(campo.k);
    const type = texto(campo.type);
    const label = texto(campo.label).trim();

    if (k === '' || !/^[a-z][a-z0-9_]*$/.test(k)) {
      errores.push(`Campo #${pos}: la clave es obligatoria (minúsculas, números y guion_bajo, iniciando con letra).`);
    } else if (vistas.has(k)) {
      errores.push(`Campo #${pos}: la clave «${k}» está repetida.`);
    }
    const tipoValido = (TIPOS_CAMPO as readonly string[]).includes(type);
    if (!tipoValido) errores.push(`Campo #${pos}: el tipo «${type}» no es válido.`);
    if (label === '') errores.push(`Campo #${pos}: la etiqueta es obligatoria.`);

    const norm: CampoDef = { k, type: type as TipoCampo, label };
    for (const opt of ['placeholder', 'help'] as const) {
      if (typeof campo[opt] === 'string' && campo[opt] !== '') norm[opt] = campo[opt] as string;
    }
    if (campo.req) norm.req = true;

    for (const lim of ['min', 'max'] as const) {
      const bruto = campo[lim];
      if (bruto === undefined || bruto === null || bruto === '') continue;
      if (!esNumerico(String(bruto))) errores.push(`Campo #${pos}: «${lim}» debe ser numérico.`);
      else norm[lim] = Number(bruto);
    }
    if (norm.min !== undefined && norm.max !== undefined && norm.min > norm.max) {
      errores.push(`Campo #${pos}: «min» no puede ser mayor que «max».`);
    }

    // expr → opción del catálogo: se congelan regex/transform en la versión.
    // Un `regex` libre enviado por el cliente se descarta.
    if (typeof campo.expr === 'string' && campo.expr !== '') {
      const clave = campo.expr;
      const opcion = expresiones[clave];
      if (!opcion) {
        errores.push(`Campo #${pos}: la validación «${clave}» no existe en el catálogo.`);
      } else if (!opcion.tipos.includes(type)) {
        errores.push(`Campo #${pos}: la validación «${clave}» no aplica a campos de tipo «${type}».`);
      } else if (opcion.regex !== null && compilarPatron(opcion.regex) === null) {
        errores.push(`Campo #${pos}: la expresión del catálogo «${clave}» no es válida.`);
      } else {
        norm.expr = clave;
        if (opcion.regex !== null) norm.regex = opcion.regex;
        if (opcion.transform !== null && TRANSFORMACIONES.includes(opcion.transform)) norm.transform = opcion.transform;
      }
    }

    if (type === 'select') {
      const opts = Array.isArray(campo.opts) ? campo.opts.map((o) => texto(o).trim()).filter((o) => o !== '') : [];
      if (opts.length === 0) errores.push(`Campo #${pos}: un «select» requiere al menos una opción.`);
      else norm.opts = opts;
    }

    if (type === 'nested') {
      const tree: NodoArbol[] = [];
      for (const nodo of Array.isArray(campo.tree) ? campo.tree : []) {
        if (esObjeto(nodo) && texto(nodo.p).trim() !== '') tree.push({ p: texto(nodo.p), c: texto(nodo.c) });
      }
      if (tree.length === 0) errores.push(`Campo #${pos}: un campo anidado requiere al menos un nodo padre.`);
      else norm.tree = tree;
      if (typeof campo.lv1 === 'string' && campo.lv1 !== '') norm.lv1 = campo.lv1;
      if (typeof campo.lv2 === 'string' && campo.lv2 !== '') norm.lv2 = campo.lv2;
    }

    // cond → debe referenciar un campo PREVIO.
    if (esObjeto(campo.cond)) {
      const ck = texto(campo.cond.k);
      const cv = texto(campo.cond.v);
      if (ck === '') errores.push(`Campo #${pos}: la condición requiere un campo de referencia.`);
      else if (!vistas.has(ck)) {
        errores.push(`Campo #${pos}: la condición debe referenciar un campo anterior («${ck}» no existe antes).`);
      } else norm.cond = { k: ck, v: cv };
    }

    if (k !== '') vistas.add(k);
    normalizados.push(norm);
  });

  return { ok: errores.length === 0, errores, definicion: { campos: normalizados } };
}

/** ¿Se cumple la condición de visibilidad? (referencia un campo previo ya validado). */
export function condicionCumplida(cond: Condicion, limpios: Valores): boolean {
  const ref = limpios[cond.k];
  const valor = ref === undefined ? '' : typeof ref === 'string' ? ref : ref.lv1;
  return valor === String(cond.v ?? '');
}

export function validarSimple(c: CampoDef, valor: string): string | null {
  if (valor === '') return c.req ? 'Campo obligatorio.' : null;
  const largo = Array.from(valor).length;
  if (largo > CAPTURA_MAX_VALOR) return 'El valor es demasiado largo.';

  switch (c.type) {
    case 'email':
      if (!esEmail(valor)) return 'Correo inválido.';
      break;
    case 'number': {
      if (!esNumerico(valor)) return 'Número inválido.';
      const n = Number(valor);
      if (c.min !== undefined && n < c.min) return `Mínimo ${c.min}.`;
      if (c.max !== undefined && n > c.max) return `Máximo ${c.max}.`;
      break;
    }
    case 'date':
      if (inputDate(valor) === null) return 'Fecha inválida.';
      break;
    case 'select':
      if (!(c.opts ?? []).includes(valor)) return 'Opción inválida.';
      break;
    default:
      if (c.min !== undefined && largo < c.min) return `Mínimo ${c.min} caracteres.`;
      if (c.max !== undefined && largo > c.max) return `Máximo ${c.max} caracteres.`;
  }

  if (c.regex && ['text', 'textarea', 'number'].includes(c.type)) {
    const patron = compilarPatron(c.regex);
    if (patron !== null && !patron.test(valor)) return 'Formato inválido.';
  }
  return null;
}

export function validarAnidado(c: CampoDef, lv1: string, lv2: string): string | null {
  if (lv1 === '' && lv2 === '') return c.req ? 'Selecciona ambos niveles.' : null;
  if (lv1 === '' || lv2 === '') return 'Selecciona ambos niveles.';
  const nodo = (c.tree ?? []).find((n) => n.p === lv1);
  if (!nodo) return 'Opción inválida.';
  return hijosDeNodo(nodo).includes(lv2) ? null : 'Opción inválida.';
}

/**
 * Valida los valores enviados contra la definición. Los campos ocultos por su
 * condición no se validan ni se guardan; las claves desconocidas se descartan.
 */
export function validarValores(
  definicion: Definicion,
  valores: unknown,
): { ok: boolean; errores: Record<string, string>; valores: Valores } {
  const entrada = esObjeto(valores) ? valores : {};
  const errores: Record<string, string> = {};
  const limpios: Valores = {};

  for (const c of definicion.campos ?? []) {
    if (c.cond && !condicionCumplida(c.cond, limpios)) continue;

    if (c.type === 'nested') {
      const v = esObjeto(entrada[c.k]) ? (entrada[c.k] as Record<string, unknown>) : {};
      const lv1 = texto(v.lv1).trim();
      const lv2 = texto(v.lv2).trim();
      const error = validarAnidado(c, lv1, lv2);
      if (error !== null) errores[c.k] = error;
      else if (lv1 !== '' || lv2 !== '') limpios[c.k] = { lv1, lv2 };
      continue;
    }

    let valor = texto(entrada[c.k]).trim();
    if (c.transform === TRANSFORMACION.MAYUSCULAS) valor = valor.toUpperCase();
    const error = validarSimple(c, valor);
    if (error !== null) errores[c.k] = error;
    else if (valor !== '') limpios[c.k] = valor;
  }

  return { ok: Object.keys(errores).length === 0, errores, valores: limpios };
}

/** Valor de un campo como texto plano (reportes y exportación). */
export function valorComoTexto(v: unknown): string {
  if (esObjeto(v)) return `${texto(v.lv1)} / ${texto(v.lv2)}`.replace(/^[ /]+|[ /]+$/g, '');
  return texto(v);
}

/** Clave estable (`k`) a partir de un encabezado de archivo. */
export function slugColumna(header: string): string {
  let s = header.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (s === '') s = 'col';
  if (/^\d/.test(s)) s = `c_${s}`;
  return s.slice(0, 40);
}

export interface ColumnaCarga { k: string; col: string; label: string }
export interface MappingCarga { busqueda: string; columnas: ColumnaCarga[] }

/**
 * Valida la definición de columnas de la card de búsqueda.
 * Entrada: { busqueda: "<encabezado>", columnas: [{col, label}] } → salida con claves `k`.
 */
export function normalizarColumnas(
  def: unknown,
  headers: string[],
): { ok: boolean; errores: string[]; columnas: MappingCarga | null } {
  if (!esObjeto(def) || !Array.isArray(def.columnas) || def.columnas.length === 0) {
    return { ok: false, errores: ['Debes elegir al menos una columna.'], columnas: null };
  }
  const errores: string[] = [];
  const columnas: ColumnaCarga[] = [];
  const usadasCol = new Set<string>();
  const usadasK = new Set<string>();
  const busqueda = texto(def.busqueda);
  let kBusqueda: string | null = null;

  for (const c of def.columnas as unknown[]) {
    const col = esObjeto(c) ? texto(c.col) : '';
    if (col === '' || !headers.includes(col)) {
      errores.push(`La columna «${col}» no existe en el archivo.`);
      continue;
    }
    if (usadasCol.has(col)) continue;
    usadasCol.add(col);

    let label = esObjeto(c) ? texto(c.label).trim() : '';
    if (label === '') label = col;
    label = Array.from(label).slice(0, 80).join('');

    const base = slugColumna(col);
    let k = base;
    let n = 2;
    while (usadasK.has(k)) k = `${base.slice(0, 36)}_${n++}`;
    usadasK.add(k);

    if (col === busqueda) kBusqueda = k;
    columnas.push({ k, col, label });
  }

  if (columnas.length === 0) errores.push('Debes elegir al menos una columna.');
  else if (kBusqueda === null) errores.push('La columna de búsqueda debe estar entre las columnas elegidas.');

  if (errores.length > 0 || kBusqueda === null) return { ok: false, errores, columnas: null };
  return { ok: true, errores: [], columnas: { busqueda: kBusqueda, columnas } };
}

/** Arma las filas de la BD con las columnas elegidas; omite las que no tienen clave de búsqueda. */
export function aplicarColumnas(headers: string[], filas: string[][], def: MappingCarga): Record<string, string>[] {
  const idx: Array<[string, number]> = [];
  for (const c of def.columnas) {
    const pos = headers.indexOf(c.col);
    if (pos !== -1) idx.push([c.k, pos]);
  }
  const out: Record<string, string>[] = [];
  for (const fila of filas) {
    const rec: Record<string, string> = {};
    for (const [k, pos] of idx) rec[k] = String(fila[pos] ?? '').trim();
    if (rec[def.busqueda]) out.push(rec);
  }
  return out;
}
