/**
 * Detalle de ventas con el diseño de `views/reportes/ventasDetalle.php`: filtros con
 * «Buscar» y «Descargar», barra de resultados con el período y tabla paginada
 * (10 por página) con el producto en píldora de color.
 */
import { useState } from 'react';
import { Box, Button, Pagination, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { FLUJO } from '@bulkapp/shared';
import { api } from '../shared/api.ts';
import { useCampanas } from '../shared/datos.tsx';
import { SinDatos, TarjetaDatos } from '../shared/graficos.tsx';
import { Consulta, Pagina, TarjetaHero, hoy, periodo, useAvisos } from '../shared/ui.tsx';
import { FiltrosVentas } from './VentasPage.tsx';

interface Filtro { desde: string; hasta: string; servicio_id: string }
interface Venta {
  nombre: string; apellido: string; cedula: string; fecha_nacimiento: string | null; telf_hab: string; telf_celular: string; correo: string;
  producto: string | null; agente: string; fecha_venta: string;
}

const PALETA_PRODUCTO = ['#dbe5fa', '#fdf0cf', '#d3f0e6', '#f7d9e0', '#e4dcf7', '#d9eef7'];
const POR_PAGINA = 10;
/** `dd-mm-aaaa`, como el detalle PHP. */
const fechaGuion = (f: string | null): string => (f ? f.slice(0, 10).split('-').reverse().join('-') : '');

export default function DetalleVentasPage() {
  const avisos = useAvisos();
  const campanas = useCampanas({ flujo: FLUJO.BANCARIO, activas: true });
  const [filtro, setFiltro] = useState<Filtro | null>(null);
  const [pagina, setPagina] = useState(1);
  const [descargando, setDescargando] = useState(false);
  const reporte = useQuery({
    queryKey: ['reportes', 'detalle-ventas', filtro], enabled: filtro !== null,
    queryFn: () => api.get<{ filas: Venta[] }>('/reportes/detalle-ventas', { ...filtro }),
  });

  const descargar = async () => {
    if (!filtro) return;
    setDescargando(true);
    try {
      await api.descargar('/reportes/detalle-ventas/exportar', { ...filtro });
    } catch (e) {
      avisos.error(e);
    } finally {
      setDescargando(false);
    }
  };

  const servicio = filtro ? campanas.data?.find((c) => String(c.id) === filtro.servicio_id)?.etiqueta : undefined;
  const hayVentas = (reporte.data?.filas.length ?? 0) > 0;

  return (
    <Pagina
      miga="Reportes / Detalle de ventas" titulo="Resumen de ventas"
      indicadores={servicio && filtro ? <TarjetaHero etiqueta="Servicio consultado" valor={servicio} periodo={periodo(filtro.desde, filtro.hasta)} /> : undefined}
    >
      <FiltrosVentas
        inicial={filtro ?? { desde: hoy(), hasta: hoy(), servicio_id: '' }} ocupado={reporte.isFetching}
        onBuscar={(f) => { setFiltro(f); setPagina(1); }}
        extra={<Button variant="outlined" sx={{ flex: 1, height: 40 }} disabled={!hayVentas} loading={descargando} onClick={() => void descargar()}>Descargar</Button>}
      />

      {filtro === null ? <SinDatos>Seleccione un rango de fechas y un servicio, luego presione <strong>Buscar</strong>.</SinDatos> : (
        <Consulta query={reporte}>
          {(r) => {
            const colores = new Map<string, string>();
            for (const v of r.filas) {
              const p = v.producto ?? '';
              if (!colores.has(p)) colores.set(p, PALETA_PRODUCTO[colores.size % PALETA_PRODUCTO.length] ?? '#eef2fb');
            }
            const paginas = Math.ceil(r.filas.length / POR_PAGINA);
            const desde = (pagina - 1) * POR_PAGINA;
            const visibles = r.filas.slice(desde, desde + POR_PAGINA);
            return (
              <TarjetaDatos>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, px: 3, py: 2, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography><b>{r.filas.length}</b> resultados</Typography>
                  <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Período {fechaGuion(filtro.desde)} – {fechaGuion(filtro.hasta)}</Typography>
                </Box>
                <TableContainer>
                  <Table stickyHeader size="small" sx={{ minWidth: 1280, '& td, & th': { fontSize: 13.5 } }}>
                    <TableHead>
                      <TableRow>
                        {['#', 'Nombre', 'Apellido', 'Cédula', 'Fecha de nacimiento', 'Teléfono 1', 'Teléfono 2', 'Correo', 'Producto', 'Agente', 'Fecha'].map((t) => <TableCell key={t}>{t}</TableCell>)}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {visibles.length === 0 && <TableRow><TableCell colSpan={11} align="center" sx={{ color: 'text.secondary', py: 6 }}>No se encontraron ventas para el filtro seleccionado.</TableCell></TableRow>}
                      {visibles.map((v, i) => (
                        <TableRow key={desde + i} hover>
                          <TableCell sx={{ color: 'text.secondary' }}>{desde + i + 1}</TableCell>
                          <TableCell sx={{ fontWeight: 500 }}>{v.nombre}</TableCell>
                          <TableCell sx={{ fontWeight: 500 }}>{v.apellido}</TableCell>
                          <TableCell>{v.cedula}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{(v.fecha_nacimiento ?? '').slice(0, 10)}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{v.telf_hab}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{v.telf_celular}</TableCell>
                          <TableCell>{v.correo}</TableCell>
                          <TableCell>
                            <Box component="span" sx={{ display: 'inline-block', borderRadius: '20px', px: 1.25, py: 0.25, fontSize: 12, fontWeight: 500, bgcolor: colores.get(v.producto ?? ''), whiteSpace: 'nowrap' }}>
                              {v.producto ?? ''}
                            </Box>
                          </TableCell>
                          <TableCell>{v.agente}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{fechaGuion(v.fecha_venta)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {paginas > 1 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, px: 3, py: 1, borderTop: 1, borderColor: 'divider' }}>
                    <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Mostrando {desde + 1}–{Math.min(desde + POR_PAGINA, r.filas.length)} de {r.filas.length} resultados</Typography>
                    <Pagination count={paginas} page={pagina} onChange={(_e, p) => setPagina(p)} size="small" color="primary" shape="rounded" />
                  </Box>
                )}
              </TarjetaDatos>
            );
          }}
        </Consulta>
      )}
    </Pagina>
  );
}
