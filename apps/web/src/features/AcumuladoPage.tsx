/**
 * Acumulado de gestión por operador, ventas por producto y motivos de contacto.
 */
import { useState, type FormEvent } from 'react';
import { Button, Grid, Stack, TableCell, TableRow } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { FLUJO } from '@bulkapp/shared';
import { api } from '../shared/api.ts';
import { Tabla, opcionesCampana, useCampanas } from '../shared/datos.tsx';
import { CampoFecha, Consulta, Pagina, Seccion, Selector, Vacio, hoy, numero } from '../shared/ui.tsx';

interface FilaGestion { id: number; nombre: string; gestion: number; noefectivos: number; efectivos: number; ventas: number }
interface Motivo { descripcion: string; total: number }
interface Acumulado {
  gestion: FilaGestion[]; ventasProducto: Array<{ id: number; producto: string; vendidos: number }>;
  motivosNoEfectivo: Motivo[]; motivosEfectivo: Motivo[];
}
interface Filtro { desde: string; hasta: string; servicio_id: string; producto_id: string }

const columnasMotivo = [
  { titulo: 'Motivo', celda: (m: Motivo) => m.descripcion },
  { titulo: 'Total', numerica: true, celda: (m: Motivo) => numero(m.total) },
];

export default function AcumuladoPage() {
  const campanas = useCampanas({ flujo: FLUJO.BANCARIO, activas: true });
  const [borrador, setBorrador] = useState<Filtro>({ desde: hoy(), hasta: hoy(), servicio_id: '', producto_id: '' });
  const [filtro, setFiltro] = useState<Filtro | null>(null);

  const productos = useQuery({
    queryKey: ['reportes', 'productos', borrador.servicio_id], enabled: borrador.servicio_id !== '',
    queryFn: () => api.get<Array<{ id: number; descripcion: string }>>('/reportes/productos', { servicio_id: borrador.servicio_id }),
  });
  const reporte = useQuery({
    queryKey: ['reportes', 'acumulado', filtro], enabled: filtro !== null,
    queryFn: () => api.get<Acumulado>('/reportes/acumulado', { ...filtro }),
  });

  const consultar = (e: FormEvent) => {
    e.preventDefault();
    setFiltro({ ...borrador });
    if (filtro !== null) void reporte.refetch();
  };

  return (
    <Pagina titulo="Acumulado de gestión" subtitulo="Gestión y ventas por operador en un rango de fechas.">
      <Stack spacing={3}>
        <Seccion>
          <Grid container spacing={2} component="form" onSubmit={consultar} sx={{ alignItems: 'center' }}>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}><CampoFecha label="Desde" value={borrador.desde} required onChange={(e) => setBorrador({ ...borrador, desde: e.target.value })} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}><CampoFecha label="Hasta" value={borrador.hasta} required onChange={(e) => setBorrador({ ...borrador, hasta: e.target.value })} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Selector
                label="Campaña" required value={borrador.servicio_id} opciones={opcionesCampana(campanas.data)} vacio="Selecciona…"
                onChange={(e) => setBorrador({ ...borrador, servicio_id: e.target.value, producto_id: '' })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Selector
                label="Producto (solo ventas)" value={borrador.producto_id} vacio="Todos" disabled={borrador.servicio_id === ''}
                opciones={(productos.data ?? []).map((p) => ({ value: String(p.id), label: p.descripcion }))}
                onChange={(e) => setBorrador({ ...borrador, producto_id: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}><Button type="submit" variant="contained" fullWidth disabled={borrador.servicio_id === ''} loading={reporte.isFetching}>Consultar</Button></Grid>
          </Grid>
        </Seccion>

        {filtro === null ? <Vacio>Elige el rango y la campaña para consultar.</Vacio> : (
          <Consulta query={reporte}>
            {(r) => {
              const t = r.gestion.reduce((a, f) => ({ g: a.g + f.gestion, n: a.n + f.noefectivos, e: a.e + f.efectivos, v: a.v + f.ventas }), { g: 0, n: 0, e: 0, v: 0 });
              return (
                <Stack spacing={3}>
                  <Seccion titulo="Gestión por operador">
                    <Tabla
                      filas={r.gestion} clave={(f) => f.id} vacio="No hay gestión en el rango consultado."
                      columnas={[
                        { titulo: 'Operador', celda: (f) => f.nombre },
                        { titulo: 'Gestión', numerica: true, celda: (f) => numero(f.gestion) },
                        { titulo: 'No efectivos', numerica: true, celda: (f) => numero(f.noefectivos) },
                        { titulo: 'Efectivos', numerica: true, celda: (f) => numero(f.efectivos) },
                        { titulo: 'Ventas', numerica: true, celda: (f) => numero(f.ventas) },
                      ]}
                      pie={(
                        <TableRow sx={{ '& td': { fontWeight: 700, fontVariantNumeric: 'tabular-nums' } }}>
                          <TableCell>Total</TableCell>
                          {[t.g, t.n, t.e, t.v].map((n, i) => <TableCell key={i} align="right">{numero(n)}</TableCell>)}
                        </TableRow>
                      )}
                    />
                  </Seccion>
                  <Grid container spacing={3}>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <Seccion titulo="Ventas por producto" sx={{ height: '100%' }}>
                        <Tabla
                          filas={r.ventasProducto} clave={(p) => p.id} vacio="Sin ventas."
                          columnas={[{ titulo: 'Producto', celda: (p) => p.producto }, { titulo: 'Vendidos', numerica: true, celda: (p) => numero(p.vendidos) }]}
                        />
                      </Seccion>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <Seccion titulo="Contactos efectivos" sx={{ height: '100%' }}>
                        <Tabla filas={r.motivosEfectivo} clave={(m) => m.descripcion} columnas={columnasMotivo} vacio="Sin contactos efectivos." />
                      </Seccion>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <Seccion titulo="Contactos no efectivos" sx={{ height: '100%' }}>
                        <Tabla filas={r.motivosNoEfectivo} clave={(m) => m.descripcion} columnas={columnasMotivo} vacio="Sin contactos no efectivos." />
                      </Seccion>
                    </Grid>
                  </Grid>
                </Stack>
              );
            }}
          </Consulta>
        )}
      </Stack>
    </Pagina>
  );
}
