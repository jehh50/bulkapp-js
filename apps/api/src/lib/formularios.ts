/**
 * Acceso a datos de los formularios dinámicos, compartido por la captura del
 * operador, el Constructor y la reportería.
 */
import { Prisma } from '@prisma/client';
import { REGISTRO, type Definicion, type MappingCarga } from '@bulkapp/shared';
import { prisma } from './core.ts';

type Json = Prisma.JsonValue;
const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function comoDefinicion(json: Json | null | undefined): Definicion {
  return esObjeto(json) && Array.isArray(json.campos) ? (json as unknown as Definicion) : { campos: [] };
}

export function comoMapping(json: Json | null | undefined): MappingCarga | null {
  if (!esObjeto(json) || typeof json.busqueda !== 'string' || !Array.isArray(json.columnas) || json.columnas.length === 0) return null;
  return json as unknown as MappingCarga;
}

export function comoRegistro(json: Json | null | undefined): Record<string, unknown> {
  return esObjeto(json) ? json : {};
}

export interface FormularioActivo {
  id: number; nombre: string; btn_texto: string; version_id: number; version: number; definicion: Definicion;
}

/** Formulario activo asignado a una campaña, con su versión vigente. */
export async function formularioActivoDeServicio(servicioId: number): Promise<FormularioActivo | null> {
  const fs = await prisma.formularioServicio.findFirst({
    where: {
      servicio_id: servicioId,
      formulario: { status_id: REGISTRO.ACTIVO, eliminado: false, versiones: { some: { vigente: true } } },
    },
    select: {
      formulario: {
        select: {
          id: true, nombre: true, btn_texto: true,
          versiones: { where: { vigente: true }, take: 1, select: { id: true, version: true, definicion: true } },
        },
      },
    },
  });
  const v = fs?.formulario.versiones[0];
  if (!fs || !v) return null;
  return {
    id: fs.formulario.id, nombre: fs.formulario.nombre, btn_texto: fs.formulario.btn_texto,
    version_id: v.id, version: v.version, definicion: comoDefinicion(v.definicion),
  };
}

export interface CargaVigente { id: number; busqueda: string; columnas: MappingCarga['columnas'] }

/** BD vigente del formulario con la definición de la card de búsqueda (o null). */
export async function cargaVigente(formularioId: number): Promise<CargaVigente | null> {
  const carga = await prisma.formularioCarga.findFirst({ where: { formulario_id: formularioId, vigente: true }, select: { id: true, mapping: true } });
  const mapping = carga ? comoMapping(carga.mapping) : null;
  return carga && mapping ? { id: carga.id, busqueda: mapping.busqueda, columnas: mapping.columnas } : null;
}

export interface RegistroCarga { id: number; datos: Record<string, unknown>; atendido: boolean }

/**
 * Registro de una carga por clave de búsqueda (o por id). Si hay varios con la
 * misma clave, devuelve primero uno no atendido.
 */
export async function buscarRegistro(cargaId: number, criterio: { clave: string } | { filaId: number }): Promise<RegistroCarga | null> {
  const condicion = 'clave' in criterio ? Prisma.sql`r.clave = ${criterio.clave}` : Prisma.sql`r.id = ${criterio.filaId}`;
  const filas = await prisma.$queryRaw<Array<{ id: bigint; fila: Json; atendido: boolean }>>(Prisma.sql`
    SELECT r.id, r.fila, (e.id IS NOT NULL) AS atendido
      FROM formulario_carga_filas r
      LEFT JOIN formulario_envios e ON e.fila_id = r.id
     WHERE r.carga_id = ${cargaId} AND ${condicion}
     ORDER BY atendido ASC, r.id ASC
     LIMIT 1`);
  const f = filas[0];
  return f ? { id: Number(f.id), datos: comoRegistro(f.fila), atendido: f.atendido } : null;
}

/** Muestra de filas de una carga. */
export async function filasDeCarga(cargaId: number, limite = 10): Promise<Record<string, unknown>[]> {
  const filas = await prisma.formularioCargaFila.findMany({ where: { carga_id: cargaId }, orderBy: { id: 'asc' }, take: limite, select: { fila: true } });
  return filas.map((f) => comoRegistro(f.fila));
}
