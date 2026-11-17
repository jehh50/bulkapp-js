/**
 * Campañas (`servicios`): flujo, catálogo base y campañas asignadas a un usuario.
 */
import { FLUJO, REGISTRO, SERVICIO_BANCARIO_BASE, etiquetaCampana, type CampanaSesion, type Flujo } from '@bulkapp/shared';
import { prisma } from './core.ts';

/** Mapa id → tipo_flujo de todas las campañas. */
export async function flujosCampana(): Promise<Map<number, Flujo>> {
  const filas = await prisma.servicio.findMany({ select: { id: true, tipo_flujo: true } });
  return new Map(filas.map((f) => [f.id, f.tipo_flujo]));
}

export async function flujoDe(servicioId: number): Promise<Flujo | null> {
  const s = await prisma.servicio.findUnique({ where: { id: servicioId }, select: { tipo_flujo: true } });
  return s ? s.tipo_flujo : null;
}

export async function esBancario(servicioId: number): Promise<boolean> {
  return (await flujoDe(servicioId)) === FLUJO.BANCARIO;
}

export async function serviciosBancarios(): Promise<number[]> {
  const filas = await prisma.servicio.findMany({ where: { tipo_flujo: FLUJO.BANCARIO }, select: { id: true }, orderBy: { id: 'asc' } });
  return filas.map((f) => f.id);
}

/** Toda campaña bancaria usa los catálogos de la campaña base (1). */
export const servicioBase = (servicioId: number, flujo: Flujo | null): number =>
  flujo === FLUJO.BANCARIO ? SERVICIO_BANCARIO_BASE : servicioId;

export interface CampanaOpcion { id: number; descripcion: string; etiqueta: string; tipo_flujo: Flujo; status_id: number }

/** Campañas con su etiqueta «Empresa › Campaña», ordenadas por etiqueta. */
export async function listarCampanas(filtro: { activas?: boolean; flujo?: Flujo } = {}): Promise<CampanaOpcion[]> {
  const filas = await prisma.servicio.findMany({
    where: {
      ...(filtro.activas ? { status_id: REGISTRO.ACTIVO } : {}),
      ...(filtro.flujo ? { tipo_flujo: filtro.flujo } : {}),
    },
    select: { id: true, descripcion: true, tipo_flujo: true, status_id: true, empresa: { select: { nombre: true } } },
  });
  return filas
    .map((s) => ({
      id: s.id,
      descripcion: s.descripcion.trim(),
      etiqueta: etiquetaCampana(s.empresa?.nombre, s.descripcion),
      tipo_flujo: s.tipo_flujo,
      status_id: s.status_id,
    }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));
}

/** Campañas activas (de empresas activas) asignadas a un usuario: selector de campaña. */
export async function campanasDeUsuario(userId: number): Promise<CampanaSesion[]> {
  const filas = await prisma.usuarioServicio.findMany({
    where: { user_id: userId, servicio: { status_id: REGISTRO.ACTIVO, empresa: { status_id: REGISTRO.ACTIVO } } },
    select: { servicio: { select: { id: true, descripcion: true, tipo_flujo: true, empresa: { select: { nombre: true } } } } },
  });
  return filas
    .map(({ servicio: s }) => ({ id: s.id, etiqueta: etiquetaCampana(s.empresa.nombre, s.descripcion), tipo_flujo: s.tipo_flujo }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));
}
