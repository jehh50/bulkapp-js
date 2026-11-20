/**
 * Acumulado de gestión con el diseño de `views/reportes/index.php`: filtros, KPIs,
 * donas (contactados vs no contactados y ventas por producto), tabla por operador
 * paginada (tarjetas en móvil) y la ventana «Motivos de contacto».
 *
 * Acepta `?servicio_id=&desde=&hasta=` (lo usa el botón de las tarjetas del dashboard).
 */
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import {
  Box, Button, Dialog, DialogContent, DialogTitle, Grid, IconButton, MenuItem, Pagination, Paper, Table, TableBody, TableCell, TableContainer,
  TableFooter, TableHead, TableRow, TextField, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useQuery } from '@tanstack/react-query';
import { FLUJO } from '@bulkapp/shared';
import { api } from '../shared/api.ts';
import { useCampanas } from '../shared/datos.tsx';
import {
  BarraProgreso, CampoFiltro, Dona, Kpi, Leyenda, Muestra, Pildora, RejillaKpi, SinDatos, TarjetaCabecera, TarjetaDatos, TarjetaFiltros, TarjetaGrafica, porcentaje,
  type ItemSerie,
} from '../shared/graficos.tsx';
import { MARCA } from '../shared/tema.ts';
import { Consulta, Pagina, TarjetaHero, hoy, periodo, useAvisos } from '../shared/ui.tsx';

interface FilaGestion { id: number; nombre: string; gestion: number; noefectivos: number; efectivos: number; ventas: number }
interface Motivo { descripcion: string; total: number }
interface Acumulado {
  gestion: FilaGestion[]; ventasProducto: Array<{ id: number; producto: string; vendidos: number }>;
  motivosNoEfectivo: Motivo[]; motivosEfectivo: Motivo[];
}
interface Filtro { desde: string; hasta: string; servicio_id: string; producto_id: string }

const AVATARES = ['#dbe5fa', '#fde7b0', '#d3f0e6', '#f7d9e0', '#e9d8b4', '#d9eef7'];
const PALETA_VENTAS = [MARCA.verde, '#8a3fb0', MARCA.dorado, '#e8743b', MARCA.verde, '#8a3fb0'];
const PALETA_MOTIVOS = ['#2f5fc4', '#12306b', '#f5b83d', '#e8743b', '#1f6b3a', '#8a3fb0', '#0f9bb5', '#d94a7a', '#8f2626'];
const POR_PAGINA = 10;

const iniciales = (nombre: string): string => nombre.trim().split(/\s+/).map((p) => p.charAt(0)).join('').toUpperCase();

/** Color de la píldora de ventas según conversión (mismas reglas del PHP). */
function tonoVentas(v: number, c: number): { fondo: string; texto: string } {
  const ratio = c > 0 ? (v / c) * 100 : 0;
  if (v === 0) return { fondo: '#fde0e0', texto: '#b42318' };
  if (ratio >= 2 && ratio < 10) return { fondo: '#ffe8cc', texto: '#b45309' };
  return { fondo: '#d3f0e6', texto: '#0b6b4f' };
}

function Avatar({ nombre, i }: { nombre: string; i: number }) {
  return (
    <Box component="span" sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: AVATARES[i % AVATARES.length], fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      {iniciales(nombre)}
    </Box>
  );
}
const InsigniaTop = () => <Box component="span" sx={{ fontSize: 11, fontWeight: 600, bgcolor: '#fdf0cf', color: '#8a5a00', borderRadius: '20px', px: 1, py: 0.25, whiteSpace: 'nowrap' }}>Top ventas</Box>;

/** Panel de motivos (`rep_motivos_panel`): cabecera de color, dona y tabla. */
function PanelMotivos({ titulo, color, filas }: { titulo: string; color: string; filas: Motivo[] }) {
  const items: ItemSerie[] = filas.map((m, i) => ({ label: m.descripcion, n: m.total, color: PALETA_MOTIVOS[i % PALETA_MOTIVOS.length] ?? MARCA.azul700 }));
  const total = items.reduce((t, i) => t + i.n, 0);
  const max = Math.max(0, ...items.map((i) => i.n));
  return (
    <TarjetaCabecera titulo={titulo} total={total} color={color}>
      {items.length === 0 ? <Typography sx={{ textAlign: 'center', color: 'text.secondary', py: 3 }}>Sin datos para mostrar</Typography> : (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}><Dona items={items} /></Box>
          <Table size="small" sx={{ '& td': { borderTop: 0, borderBottom: 1, borderColor: 'divider' } }}>
            <TableBody>
              {items.map((it) => {
                const fw = it.n === max && max > 0 ? 600 : 400;
                return (
                  <TableRow key={it.label}>
                    <TableCell sx={{ pl: '8px !important' }}><Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: fw }}><Muestra color={it.color} />{it.label}</Box></TableCell>
                    <TableCell align="right" sx={{ fontWeight: fw }}>{it.n}</TableCell>
                    <TableCell align="right" sx={{ width: 56, color: 'text.secondary' }}>{porcentaje(it.n, total)}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </>
      )}
    </TarjetaCabecera>
  );
}

function Resultado({ r, servicio }: { r: Acumulado; servicio: string }) {
  const tema = useTheme();
  const escritorio = useMediaQuery(tema.breakpoints.up('lg'));
  const [pagina, setPagina] = useState(1);
  const [motivos, setMotivos] = useState(false);

  const filas = r.gestion.map((g) => ({ ...g, pc: porcentaje(g.efectivos, g.gestion), pnc: porcentaje(g.noefectivos, g.gestion), pv: porcentaje(g.ventas, g.efectivos) }));
  const t = filas.reduce((a, f) => ({ g: a.g + f.gestion, c: a.c + f.efectivos, v: a.v + f.ventas }), { g: 0, c: 0, v: 0 });
  const tnc = t.g - t.c;
  const pc = porcentaje(t.c, t.g);
  const pnc = porcentaje(tnc, t.g);
  const pv = porcentaje(t.v, t.c);
  const maxV = Math.max(0, ...filas.map((f) => f.ventas));

  const paginas = Math.ceil(filas.length / POR_PAGINA);
  const visibles = paginas > 1 ? filas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA) : filas;
  const desplazamiento = paginas > 1 ? (pagina - 1) * POR_PAGINA : 0;

  const contacto: ItemSerie[] = [{ label: 'Contactados', n: t.c, color: MARCA.azul700 }, { label: 'No contactados', n: tnc, color: '#d5dcec' }];
  const ventas: ItemSerie[] = r.ventasProducto.map((p, i) => ({ label: p.producto, n: p.vendidos, color: PALETA_VENTAS[i % PALETA_VENTAS.length] ?? MARCA.verde }));

  const paginacion = paginas > 1 && (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, px: 2, py: 1, borderTop: 1, borderColor: 'divider', bgcolor: '#fff' }}>
      <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Mostrando {desplazamiento + 1}–{Math.min(pagina * POR_PAGINA, filas.length)} de {filas.length} operadores</Typography>
      <Pagination count={paginas} page={pagina} onChange={(_e, p) => setPagina(p)} size="small" color="primary" shape="rounded" />
    </Box>
  );

  return (
    <>
      <RejillaKpi>
        <Kpi etiqueta="Gestionados" valor={t.g} color={MARCA.azul700} sufijo="registros" />
        <Kpi etiqueta="Contactados" valor={t.c} color="#2f7bd1" sufijo={`${pc}%`} />
        <Kpi etiqueta="No contactados" valor={tnc} color="#8a94ab" sufijo={`${pnc}%`} />
        <Kpi etiqueta="Ventas" valor={t.v} color={MARCA.verde} sufijo={`${pv}% de contactados`} />
      </RejillaKpi>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', gap: 2, mb: 2.5 }}>
        <TarjetaGrafica titulo="Contactados vs no contactados" accion={<Button variant="contained" size="small" sx={{ px: 1.5 }} onClick={() => setMotivos(true)}>Ver motivos de contacto →</Button>}>
          <Dona items={contacto} etiqueta="Gestión" total={t.g} />
          <Leyenda items={contacto} />
        </TarjetaGrafica>
        <TarjetaGrafica titulo="Ventas por producto">
          <Dona items={ventas} etiqueta="Ventas" total={ventas.reduce((s, i) => s + i.n, 0)} />
          <Leyenda items={ventas} />
        </TarjetaGrafica>
      </Box>

      {escritorio ? (
        <TarjetaDatos>
          <TableContainer>
            <Table sx={{ '& td, & th': { fontSize: 14, textAlign: 'right' }, '& td:first-of-type, & th:first-of-type': { textAlign: 'left', pl: 3 } }}>
              <TableHead>
                <TableRow>
                  <TableCell>Operador</TableCell><TableCell>Gestionados</TableCell><TableCell>Contactados</TableCell><TableCell>No contact.</TableCell><TableCell>Ventas</TableCell>
                  <TableCell sx={{ textAlign: 'left !important' }}>% Contacto</TableCell><TableCell>% No Contacto</TableCell><TableCell>% Ventas</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibles.map((f, i) => {
                  const tono = tonoVentas(f.ventas, f.efectivos);
                  const cero = f.ventas === 0;
                  return (
                    <TableRow key={f.id} hover sx={cero ? { '& td': { bgcolor: '#fff5f5' } } : undefined}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar nombre={f.nombre} i={desplazamiento + i} />
                          <Box component="span" sx={{ fontWeight: 500 }}>{f.nombre}</Box>
                          {maxV > 0 && f.ventas === maxV && <InsigniaTop />}
                        </Box>
                      </TableCell>
                      <TableCell>{f.gestion}</TableCell>
                      <TableCell>{f.efectivos}</TableCell>
                      <TableCell>{f.noefectivos}</TableCell>
                      <TableCell><Pildora fondo={tono.fondo} texto={tono.texto}>{f.ventas}</Pildora></TableCell>
                      <TableCell colSpan={2} sx={{ textAlign: 'left !important', minWidth: 220 }}>
                        <BarraProgreso pct={f.pc} fondo="#d5dcec" />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, mt: 0.5 }}><span>{f.pc}%</span><span>{f.pnc}%</span></Box>
                      </TableCell>
                      <TableCell><Pildora fondo={tono.fondo} texto={tono.texto} ancha>{f.pv}%</Pildora></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Totales</TableCell><TableCell>{t.g}</TableCell><TableCell>{t.c}</TableCell><TableCell>{tnc}</TableCell><TableCell>{t.v}</TableCell>
                  <TableCell colSpan={2} sx={{ textAlign: 'left !important', fontWeight: 500, fontSize: '13px !important' }}>{pc}% CONTACTO · {pnc}% NO CONTACTO</TableCell>
                  <TableCell>{pv}%</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </TableContainer>
          {paginacion}
        </TarjetaDatos>
      ) : (
        <Box sx={{ mb: 2.5 }}>
          <Typography sx={{ fontWeight: 600, fontSize: 16, px: 0.5, mb: 1.5 }}>Desempeño por operador{servicio ? ` · ${servicio}` : ''}</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {visibles.map((f, i) => {
              const tono = tonoVentas(f.ventas, f.efectivos);
              return (
                <Paper key={f.id} variant="outlined" sx={{ p: 2, bgcolor: f.ventas === 0 ? '#fff5f5' : '#fff' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                    <Avatar nombre={f.nombre} i={desplazamiento + i} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{f.nombre}</Typography>
                      {maxV > 0 && f.ventas === maxV && <InsigniaTop />}
                    </Box>
                    <Pildora fondo={tono.fondo} texto={tono.texto} ancha>{f.pv}%</Pildora>
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, textAlign: 'center', mb: 1.5 }}>
                    {[[f.gestion, 'Gest.'], [f.efectivos, 'Contact.'], [f.noefectivos, 'No cont.'], [f.ventas, 'Ventas']].map(([n, l], k) => (
                      <Box key={l}>
                        <Typography sx={{ fontSize: 18, fontWeight: 600, color: k === 3 ? tono.texto : 'inherit' }}>{n}</Typography>
                        <Typography sx={{ fontSize: 10.5, textTransform: 'uppercase' }}>{l}</Typography>
                      </Box>
                    ))}
                  </Box>
                  <BarraProgreso pct={f.pc} fondo="#d5dcec" />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, mt: 0.5 }}><span>{f.pc}% contactados</span><span>{f.pnc}% no</span></Box>
                </Paper>
              );
            })}
            <Box sx={{ bgcolor: MARCA.azul900, color: '#fff', borderRadius: '16px', p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, fontWeight: 600 }}>
              <span>Totales</span>
              <Box component="span" sx={{ fontSize: 13, fontWeight: 500 }}>{t.g} gest. · {t.c} cont. · {t.v} ventas · {pv}%</Box>
            </Box>
            {paginas > 1 && <Box sx={{ display: 'flex', justifyContent: 'center' }}><Pagination count={paginas} page={pagina} onChange={(_e, p) => setPagina(p)} size="small" color="primary" shape="rounded" /></Box>}
          </Box>
        </Box>
      )}

      <Dialog open={motivos} onClose={() => setMotivos(false)} maxWidth="lg" fullWidth scroll="paper">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Motivos de contacto
          <IconButton aria-label="Cerrar" onClick={() => setMotivos(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ alignItems: 'flex-start' }}>
            <Grid size={{ xs: 12, lg: 6 }}><PanelMotivos titulo="No contacto" color="#8f2626" filas={r.motivosNoEfectivo} /></Grid>
            <Grid size={{ xs: 12, lg: 6 }}><PanelMotivos titulo="Contacto" color="#1f6b3a" filas={r.motivosEfectivo} /></Grid>
          </Grid>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AcumuladoPage() {
  const avisos = useAvisos();
  const [params, setParams] = useSearchParams();
  const campanas = useCampanas({ flujo: FLUJO.BANCARIO, activas: true });
  const desdeUrl = params.get('servicio_id') ? { desde: params.get('desde') ?? hoy(), hasta: params.get('hasta') ?? hoy(), servicio_id: params.get('servicio_id') ?? '', producto_id: '' } : null;
  const [borrador, setBorrador] = useState<Filtro>(desdeUrl ?? { desde: hoy(), hasta: hoy(), servicio_id: '', producto_id: '' });
  const [filtro, setFiltro] = useState<Filtro | null>(desdeUrl);

  const productos = useQuery({
    queryKey: ['reportes', 'productos', borrador.servicio_id], enabled: borrador.servicio_id !== '',
    queryFn: () => api.get<Array<{ id: number; descripcion: string }>>('/reportes/productos', { servicio_id: borrador.servicio_id }),
  });
  const reporte = useQuery({
    queryKey: ['reportes', 'acumulado', filtro], enabled: filtro !== null,
    queryFn: () => api.get<Acumulado>('/reportes/acumulado', { ...filtro }),
  });

  const buscar = (e: FormEvent) => {
    e.preventDefault();
    if (borrador.servicio_id === '') { avisos.error('Por favor seleccione un servicio.'); return; }
    if (borrador.hasta < borrador.desde) { avisos.error('La fecha «Hasta» es menor a la fecha «Desde». Por favor verifique.'); return; }
    setFiltro({ ...borrador });
    if (params.size > 0) setParams({}, { replace: true });
  };

  const servicio = filtro ? (campanas.data?.find((c) => String(c.id) === filtro.servicio_id)?.etiqueta ?? '') : '';
  const fecha = (k: 'desde' | 'hasta') => (
    <TextField id={k} type="date" fullWidth value={borrador[k]} onChange={(e) => setBorrador({ ...borrador, [k]: e.target.value })} />
  );

  return (
    <Pagina
      miga="Reportes / Acumulado de gestión" titulo="Resumen de gestión por operador"
      indicadores={filtro && servicio ? <TarjetaHero etiqueta="Servicio consultado" valor={servicio} periodo={periodo(filtro.desde, filtro.hasta)} /> : undefined}
    >
      <TarjetaFiltros>
        <Grid container spacing={2} component="form" onSubmit={buscar} sx={{ alignItems: 'flex-end' }}>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><CampoFiltro etiqueta="Desde" htmlFor="desde">{fecha('desde')}</CampoFiltro></Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><CampoFiltro etiqueta="Hasta" htmlFor="hasta">{fecha('hasta')}</CampoFiltro></Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <CampoFiltro etiqueta="Servicio" htmlFor="servicio">
              <TextField
                id="servicio" select fullWidth value={borrador.servicio_id}
                onChange={(e) => setBorrador({ ...borrador, servicio_id: e.target.value, producto_id: '' })}
                slotProps={{ select: { displayEmpty: true } }}
              >
                <MenuItem value="" disabled>Seleccione...</MenuItem>
                {(campanas.data ?? []).map((c) => <MenuItem key={c.id} value={String(c.id)}>{c.etiqueta}</MenuItem>)}
              </TextField>
            </CampoFiltro>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <CampoFiltro etiqueta="Producto" htmlFor="producto">
              <TextField
                id="producto" select fullWidth value={borrador.producto_id} disabled={borrador.servicio_id === ''}
                onChange={(e) => setBorrador({ ...borrador, producto_id: e.target.value })} slotProps={{ select: { displayEmpty: true } }}
              >
                <MenuItem value="">Seleccione...</MenuItem>
                {(productos.data ?? []).map((p) => <MenuItem key={p.id} value={String(p.id)}>{p.descripcion}</MenuItem>)}
              </TextField>
            </CampoFiltro>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <Button type="submit" variant="contained" fullWidth loading={reporte.isFetching} sx={{ height: 42 }}>Buscar</Button>
          </Grid>
        </Grid>
      </TarjetaFiltros>

      {filtro === null ? <SinDatos>Seleccione un servicio y un rango de fechas, luego presione <strong>Buscar</strong>.</SinDatos> : (
        <Consulta query={reporte}>
          {(r) => (r.gestion.length === 0
            ? <SinDatos>Seleccione un servicio y un rango de fechas, luego presione <strong>Buscar</strong>.</SinDatos>
            : <Resultado key={JSON.stringify(filtro)} r={r} servicio={servicio} />)}
        </Consulta>
      )}
    </Pagina>
  );
}
