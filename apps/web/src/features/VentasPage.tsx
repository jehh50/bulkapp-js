/**
 * Ventas por estado con el diseño de `views/reportes/ventas.php`: tabla con cabecera
 * granate y mini barras + dona con leyenda. Al elegir un estado se abre el detalle
 * por ciudad (`ventasxciudad.php`) con «← Volver a ventas por estado».
 * Los filtros viven en la URL para que «Volver» y recargar conserven la consulta.
 */
import { useState, type FormEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Box, Button, Grid, MenuItem, Paper, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { FLUJO } from '@bulkapp/shared';
import { api } from '../shared/api.ts';
import { useCampanas } from '../shared/datos.tsx';
import { CampoFiltro, Dona, Muestra, SinDatos, TarjetaCabecera, TarjetaFiltros, colorSerie, type ItemSerie } from '../shared/graficos.tsx';
import { Consulta, Pagina, TarjetaHero, hoy, periodo, useAvisos } from '../shared/ui.tsx';

interface Filtro { desde: string; hasta: string; servicio_id: string }
interface Fila { id: number; nombre: string; total: number }

const GRANATE = '#8f2626';

/** Filtros de ventas (Desde, Hasta, Servicio, Buscar) con etiquetas arriba. */
export function FiltrosVentas({ inicial, ocupado, extra, onBuscar }: {
  inicial: Filtro; ocupado: boolean; extra?: ReactNode; onBuscar: (f: Filtro) => void;
}) {
  const avisos = useAvisos();
  const campanas = useCampanas({ flujo: FLUJO.BANCARIO, activas: true });
  const [b, setB] = useState<Filtro>(inicial);
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (b.servicio_id === '') { avisos.error('Por favor seleccione un servicio.'); return; }
    if (b.hasta < b.desde) { avisos.error('La fecha «Hasta» es menor a la fecha «Desde». Por favor verifique.'); return; }
    onBuscar(b);
  };
  return (
    <TarjetaFiltros>
      <Grid container spacing={2} component="form" onSubmit={enviar} sx={{ alignItems: 'flex-end' }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <CampoFiltro etiqueta="Desde" htmlFor="fecha_d"><TextField id="fecha_d" type="date" fullWidth required value={b.desde} onChange={(e) => setB({ ...b, desde: e.target.value })} /></CampoFiltro>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <CampoFiltro etiqueta="Hasta" htmlFor="fecha_h"><TextField id="fecha_h" type="date" fullWidth required value={b.hasta} onChange={(e) => setB({ ...b, hasta: e.target.value })} /></CampoFiltro>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <CampoFiltro etiqueta="Servicio" htmlFor="servicio">
            <TextField id="servicio" select fullWidth value={b.servicio_id} onChange={(e) => setB({ ...b, servicio_id: e.target.value })} slotProps={{ select: { displayEmpty: true } }}>
              <MenuItem value="" disabled>Seleccione...</MenuItem>
              {(campanas.data ?? []).map((c) => <MenuItem key={c.id} value={String(c.id)}>{c.etiqueta}</MenuItem>)}
            </TextField>
          </CampoFiltro>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button type="submit" variant="contained" loading={ocupado} sx={{ flex: 1, height: 40 }}>Buscar</Button>
            {extra}
          </Box>
        </Grid>
      </Grid>
    </TarjetaFiltros>
  );
}

/** Tabla con cabecera granate (estado o ciudad) y la dona a la derecha. */
function TablaYDona({ filas, titulo, columna, grafica, onElegir }: {
  filas: Fila[]; titulo: string; columna: string; grafica: string; onElegir?: (f: Fila) => void;
}) {
  const total = filas.reduce((t, f) => t + f.total, 0);
  const max = Math.max(0, ...filas.map((f) => f.total));
  const items: ItemSerie[] = filas.map((f, i) => ({ label: f.nombre.trim(), n: f.total, color: colorSerie(i) }));
  const pct = (n: number) => (total ? Math.round((n / total) * 1000) / 10 : 0);
  const cabecera = { position: 'sticky', top: 0, bgcolor: '#fff !important', color: 'text.secondary' } as const;

  return (
    <Grid container spacing={3} sx={{ alignItems: 'flex-start', mb: 2.5 }}>
      <Grid size={{ xs: 12, lg: 6 }}>
        <TarjetaCabecera titulo={titulo} total={total} sub="ventas" color={GRANATE}>
          <TableContainer sx={{ maxHeight: 460 }}>
            <Table size="small">
              <TableHead>
                <TableRow><TableCell sx={cabecera}>{columna}</TableCell><TableCell align="right" sx={cabecera}>Ventas</TableCell><TableCell align="right" sx={{ ...cabecera, width: 64 }}>%</TableCell></TableRow>
              </TableHead>
              <TableBody>
                {items.length === 0 && <TableRow><TableCell colSpan={3} align="center" sx={{ color: 'text.secondary', py: 3 }}>Sin datos para mostrar</TableCell></TableRow>}
                {filas.map((f, i) => {
                  const it = items[i]!;
                  return (
                    <TableRow
                      key={f.id} hover onClick={onElegir ? () => onElegir(f) : undefined}
                      sx={onElegir ? { cursor: 'pointer' } : undefined} tabIndex={onElegir ? 0 : undefined}
                      onKeyDown={onElegir ? (e) => { if (e.key === 'Enter') onElegir(f); } : undefined}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Muestra color={it.color} />
                          <Box component="span" sx={{ fontWeight: 500 }}>{it.label}</Box>
                          {onElegir && <Box component="span" sx={{ color: 'text.secondary', fontSize: 13 }}>→</Box>}
                        </Box>
                        <Box sx={{ height: 4, borderRadius: 4, bgcolor: '#eef0f4', mt: 0.5, ml: 3 }}>
                          <Box sx={{ height: '100%', borderRadius: 4, width: `${max ? Math.round((f.total / max) * 100) : 0}%`, bgcolor: it.color }} />
                        </Box>
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>{f.total}</TableCell>
                      <TableCell align="right" sx={{ color: 'text.secondary' }}>{pct(f.total)}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              {items.length > 0 && (
                <TableFooter>
                  <TableRow sx={{ '& td': { bgcolor: '#fbeaea !important', color: 'text.primary !important', fontWeight: 700 } }}>
                    <TableCell>Total</TableCell><TableCell align="right">{total}</TableCell><TableCell align="right">100%</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </TableContainer>
          {onElegir && items.length > 0 && <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 2 }}>Haz clic en un estado para ver el detalle por ciudad.</Typography>}
        </TarjetaCabecera>
      </Grid>
      <Grid size={{ xs: 12, lg: 6 }}>
        <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
          <Typography sx={{ fontWeight: 600, mb: 2 }}>{grafica}</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
            <Dona items={items} etiqueta="Ventas" total={total} tamano="lg" />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1, flex: 1, minWidth: 200 }}>
              {items.map((i) => (
                <Box key={i.label} sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 13, minWidth: 0 }}>
                  <Muestra color={i.color} />
                  <Box component="span" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.label}</Box>
                  <Box component="span" sx={{ color: 'text.secondary' }}>{pct(i.n)}%</Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Paper>
      </Grid>
    </Grid>
  );
}

export default function VentasPage() {
  const [params, setParams] = useSearchParams();
  const campanas = useCampanas({ flujo: FLUJO.BANCARIO, activas: true });
  const filtro: Filtro | null = params.get('servicio_id')
    ? { desde: params.get('desde') ?? hoy(), hasta: params.get('hasta') ?? hoy(), servicio_id: params.get('servicio_id') ?? '' }
    : null;
  const estadoId = params.get('estado_id');
  const estadoNombre = params.get('estado') ?? '';

  const estados = useQuery({
    queryKey: ['reportes', 'ventas-estado', filtro], enabled: filtro !== null && !estadoId,
    queryFn: () => api.get<{ filas: Array<{ id: number; estado: string; total: number }> }>('/reportes/ventas-estado', { ...filtro }),
  });
  const ciudades = useQuery({
    queryKey: ['reportes', 'ventas-ciudad', filtro, estadoId], enabled: filtro !== null && !!estadoId,
    queryFn: () => api.get<{ estado: string; filas: Array<{ id: number; ciudad: string; total: number }> }>('/reportes/ventas-ciudad', { ...filtro, estado_id: estadoId }),
  });

  const buscar = (f: Filtro) => setParams({ ...f });
  const servicio = filtro ? campanas.data?.find((c) => String(c.id) === filtro.servicio_id)?.etiqueta : undefined;
  const hero = servicio && filtro ? <TarjetaHero etiqueta="Servicio consultado" valor={servicio} periodo={periodo(filtro.desde, filtro.hasta)} /> : undefined;
  const inicial = filtro ?? { desde: hoy(), hasta: hoy(), servicio_id: '' };

  if (filtro && estadoId) {
    return (
      <Pagina miga={`Reportes / Ventas por estado / ${estadoNombre}`} titulo="Detalle de ventas por estado" acento={estadoNombre} indicadores={hero}>
        <FiltrosVentas key={JSON.stringify(filtro)} inicial={inicial} ocupado={ciudades.isFetching} onBuscar={buscar} />
        <Button variant="outlined" sx={{ mb: 2, fontWeight: 600 }} onClick={() => setParams({ ...filtro })}>← Volver a ventas por estado</Button>
        <Consulta query={ciudades}>
          {(c) => <TablaYDona filas={c.filas.map((f) => ({ id: f.id, nombre: f.ciudad, total: f.total }))} titulo="Ventas por ciudad" columna="Ciudad" grafica="Ventas x ciudad" />}
        </Consulta>
      </Pagina>
    );
  }

  return (
    <Pagina miga="Reportes / Ventas por estado" titulo="Resumen de ventas por estado" indicadores={hero}>
      <FiltrosVentas key={JSON.stringify(filtro)} inicial={inicial} ocupado={estados.isFetching} onBuscar={buscar} />
      {filtro === null ? <SinDatos>Seleccione un rango de fechas y un servicio, luego presione <strong>Buscar</strong>.</SinDatos> : (
        <Consulta query={estados}>
          {(r) => (
            <TablaYDona
              filas={r.filas.map((f) => ({ id: f.id, nombre: f.estado, total: f.total }))} titulo="Ventas por estado" columna="Estado" grafica="Ventas x estado"
              onElegir={(f) => setParams({ ...filtro, estado_id: String(f.id), estado: f.nombre.trim() })}
            />
          )}
        </Consulta>
      )}
    </Pagina>
  );
}
