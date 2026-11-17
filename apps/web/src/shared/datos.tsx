/**
 * Consultas y componentes de datos reutilizados por reportes y administración.
 */
import type { ReactNode } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import type { Flujo } from '@bulkapp/shared';
import { api } from './api.ts';
import { Vacio, type Opcion } from './ui.tsx';

export interface Campana { id: number; descripcion: string; etiqueta: string; tipo_flujo: Flujo; status_id: number }

/** Campañas para selectores (Supervisor y Administrador). */
export function useCampanas(filtro: { flujo?: Flujo; activas?: boolean } = {}) {
  return useQuery({
    queryKey: ['campanas', filtro.flujo ?? 'todas', filtro.activas ?? false],
    queryFn: () => api.get<Campana[]>('/reportes/campanas', { flujo: filtro.flujo, activas: filtro.activas ? 1 : undefined }),
    staleTime: 120_000,
  });
}

export const opcionesCampana = (campanas: Campana[] | undefined): Opcion[] => (campanas ?? []).map((c) => ({ value: String(c.id), label: c.etiqueta }));

export interface Columna<T> {
  titulo: string;
  celda: (fila: T, indice: number) => ReactNode;
  numerica?: boolean;
  ancho?: number | string;
}

/** Tabla densa con mensaje de vacío. `clave` identifica cada fila de forma estable. */
export function Tabla<T>({ filas, columnas, clave, vacio = 'Sin resultados.', pie }: {
  filas: readonly T[]; columnas: Array<Columna<T>>; clave: (fila: T, indice: number) => string | number; vacio?: string; pie?: ReactNode;
}) {
  if (filas.length === 0) return <Vacio>{vacio}</Vacio>;
  return (
    <TableContainer>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            {columnas.map((c) => <TableCell key={c.titulo} align={c.numerica ? 'right' : 'left'} sx={{ width: c.ancho }}>{c.titulo}</TableCell>)}
          </TableRow>
        </TableHead>
        <TableBody>
          {filas.map((fila, i) => (
            <TableRow key={clave(fila, i)} hover>
              {columnas.map((c) => (
                <TableCell key={c.titulo} align={c.numerica ? 'right' : 'left'} sx={c.numerica ? { fontVariantNumeric: 'tabular-nums' } : undefined}>
                  {c.celda(fila, i)}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {pie}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
