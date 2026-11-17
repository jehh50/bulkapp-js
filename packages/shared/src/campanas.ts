/**
 * Clientes (empresas) y campañas: validación pura, sin base de datos.
 * Una campaña ES un registro de `servicios`; su nombre vive en `descripcion`.
 */
import { CAMPANAS_SEPARADOR, FLUJO, FLUJOS, REGISTRO, type Flujo } from './constants.ts';
import { inputDate, inputEnum, inputInt } from './input.ts';

/** Etiqueta «Empresa › Campaña»; si se llaman igual, solo el nombre. */
export function etiquetaCampana(empresa: string | null | undefined, campana: string): string {
  const c = (campana ?? '').trim();
  const e = (empresa ?? '').trim();
  if (e === '' || e.toLowerCase() === c.toLowerCase()) return c;
  return e + CAMPANAS_SEPARADOR + c;
}

/** Normaliza un RIF (J-12345678-9). Devuelve '' si viene vacío y null si es inválido. */
export function normalizarRif(valor: unknown): string | null {
  const v = String(valor ?? '').replace(/[\s.]/g, '').toUpperCase();
  if (v === '') return '';
  const m = /^([VEJPG])-?(\d{6,8})-?(\d)?$/.exec(v);
  if (!m) return null;
  return `${m[1]}-${m[2]}${m[3] ? `-${m[3]}` : ''}`;
}

export interface Validacion<T> {
  ok: boolean;
  errores: string[];
  datos: T;
}

export interface EmpresaDatos {
  nombre: string;
  identificacion: string | null;
  status_id: number;
}

export function validarEmpresa(entrada: Record<string, unknown>): Validacion<EmpresaDatos> {
  const errores: string[] = [];
  const nombre = String(entrada.nombre ?? '').replace(/\s+/g, ' ').trim();
  if (nombre === '') errores.push('El nombre del cliente es obligatorio.');
  else if (nombre.length > 100) errores.push('El nombre del cliente admite hasta 100 caracteres.');

  const rif = normalizarRif(entrada.identificacion);
  if (rif === null) errores.push('El RIF no es válido (formato J-12345678-9).');

  const estado = inputEnum(entrada.status_id, [REGISTRO.ACTIVO, REGISTRO.INACTIVO]) ?? REGISTRO.ACTIVO;
  return {
    ok: errores.length === 0,
    errores,
    datos: { nombre, identificacion: rif === null || rif === '' ? null : rif, status_id: estado },
  };
}

export interface CampanaDatos {
  nombre: string;
  detalle: string | null;
  fecha_inicio: string | null;
  meta: number | null;
  codigo: string;
  status_id: number;
  tipo_flujo?: Flujo | null;
}

/**
 * El flujo solo se fija al crear: cambiarlo después re-enrutaría su historial.
 * El código es obligatorio en campañas bancarias (company code del XML).
 */
export function validarCampana(entrada: Record<string, unknown>, esNueva: boolean): Validacion<CampanaDatos> {
  const errores: string[] = [];
  const nombre = String(entrada.nombre ?? '').replace(/\s+/g, ' ').trim();
  if (nombre === '') errores.push('El nombre de la campaña es obligatorio.');
  else if (nombre.length > 50) errores.push('El nombre de la campaña admite hasta 50 caracteres.');

  const detalle = String(entrada.detalle ?? '').trim();
  if (detalle.length > 500) errores.push('La descripción admite hasta 500 caracteres.');

  const fecha = inputDate(entrada.fecha_inicio);
  if (fecha === null) errores.push('La fecha de inicio es obligatoria (AAAA-MM-DD).');

  const metaRaw = String(entrada.meta ?? '').trim();
  let meta: number | null = null;
  if (metaRaw !== '') {
    meta = inputInt(metaRaw, 1, 100_000_000);
    if (meta === null) errores.push('La meta debe ser un número entero mayor que cero.');
  }

  let flujo: Flujo | null = null;
  if (esNueva) {
    flujo = inputEnum(entrada.tipo_flujo, FLUJOS);
    if (flujo === null) errores.push('Selecciona el tipo de flujo de la campaña.');
  }

  const codigo = String(entrada.codigo ?? '').trim().toUpperCase();
  if (codigo.length > 10 || (codigo !== '' && !/^[A-Z0-9_-]+$/.test(codigo))) {
    errores.push('El código admite hasta 10 letras, dígitos, guion o guion bajo.');
  } else if (esNueva && flujo === FLUJO.BANCARIO && codigo === '') {
    errores.push('Las campañas bancarias requieren código (company code del XML).');
  }

  const estado = inputEnum(entrada.status_id, [REGISTRO.ACTIVO, REGISTRO.INACTIVO]) ?? REGISTRO.ACTIVO;
  const datos: CampanaDatos = {
    nombre,
    detalle: detalle === '' ? null : detalle,
    fecha_inicio: fecha,
    meta,
    codigo,
    status_id: estado,
  };
  if (esNueva) datos.tipo_flujo = flujo;
  return { ok: errores.length === 0, errores, datos };
}
