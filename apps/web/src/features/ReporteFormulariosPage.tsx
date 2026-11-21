/**
 * Reporte de formularios dinámicos con el diseño de `views/captura/reporte.php`:
 * filtros en cascada 1 · Cliente → 2 · Campaña → 3 · Formulario + rango, con
 * «Buscar» y «Limpiar»; barra con total, columnas, versión, filas por página y
 * «Exportar a Excel»; tabla con encabezado agrupado (Gestión / Datos de la búsqueda
 * / Formulario). Los filtros aplicados viven en la URL.
 */
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { Box, Button, MenuItem, Pagination, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import TableIcon from '@mui/icons-material/TableChartOutlined';
import ExcelIcon from '@mui/icons-material/GridOnOutlined';
import { useQuery } from '@tanstack/react-query';
import { REPORTE_FILAS_POR_PAGINA } from '@bulkapp/shared';
import { api } from '../shared/api.ts';
import { CampoFiltro, TarjetaDatos, TarjetaFiltros } from '../shared/graficos.tsx';
import { MARCA } from '../shared/tema.ts';
import { Consulta, Pagina, TarjetaHero, numero, periodo, useAvisos } from '../shared/ui.tsx';

interface Nodo { id: number; nombre: string }
interface NodoCampana extends Nodo { formularios: Nodo[] }
interface NodoCliente extends Nodo { campanas: NodoCampana[] }
interface Columna { k: string; label: string; tipo: string }
interface Fila { id: number; fecha: string; operador: string; usuario: string; version: number; bd: Record<string, string>; campos: Record<string, string> }
interface Reporte {
  arbol: NodoCliente[]; desde: string; hasta: string; seleccion: { cliente: Nodo; campana: Nodo; formulario: Nodo } | null;
  columnas: { bd: Columna[]; campos: Columna[] }; filas: Fila[]; total: number; pagina: number; totalPaginas: number; porPagina: number;
  versionVigente?: number | null; etiqueta?: string;
}

const CLAVES = ['cliente', 'campana', 'formulario', 'desde', 'hasta', 'n', 'p'] as const;
type Clave = (typeof CLAVES)[number];
type Borrador = Pick<Record<Clave, string>, 'cliente' | 'campana' | 'formulario' | 'desde' | 'hasta'>;

/** `dd/mm/aaaa hh:mm` desde `aaaa-mm-dd hh:mm:ss`. */
const fechaHoraCorta = (f: string): string => (f.length >= 16 ? `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)} ${f.slice(11, 16)}` : f);

function Filtros({ r, aplicado, ocupado, onBuscar, onLimpiar }: {
  r: Reporte; aplicado: Borrador; ocupado: boolean; onBuscar: (b: Borrador) => void; onLimpiar: () => void;
}) {
  const [b, setB] = useState<Borrador>({ ...aplicado, desde: aplicado.desde || r.desde, hasta: aplicado.hasta || r.hasta });
  const cliente = r.arbol.find((c) => String(c.id) === b.cliente);
  const campana = cliente?.campanas.find((c) => String(c.id) === b.campana);
  const listo = Boolean(campana?.formularios.some((f) => String(f.id) === b.formulario)) && b.desde !== '' && b.hasta !== '';
  const enviar = (e: FormEvent) => { e.preventDefault(); if (listo) onBuscar(b); };
  const selector = (id: string, valor: string, vacio: string, opciones: Nodo[], deshabilitado: boolean, cambio: (v: string) => void) => (
    <TextField
      id={id} select fullWidth value={opciones.some((o) => String(o.id) === valor) ? valor : ''} disabled={deshabilitado}
      onChange={(e) => cambio(e.target.value)} slotProps={{ select: { displayEmpty: true } }}
      sx={{ '& .Mui-disabled': { bgcolor: '#f3f4f6' } }}
    >
      <MenuItem value="">{vacio}</MenuItem>
      {opciones.map((o) => <MenuItem key={o.id} value={String(o.id)}>{o.nombre}</MenuItem>)}
    </TextField>
  );

  return (
    <TarjetaFiltros>
      <Box component="form" onSubmit={enviar} sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 2, alignItems: 'end' }}>
        <CampoFiltro etiqueta="1 · Cliente" htmlFor="repCliente">
          {selector('repCliente', b.cliente, 'Selecciona…', r.arbol, false, (v) => setB({ ...b, cliente: v, campana: '', formulario: '' }))}
        </CampoFiltro>
        <CampoFiltro etiqueta="2 · Campaña" htmlFor="repCampana">
          {selector('repCampana', b.campana, cliente ? 'Selecciona…' : 'Elige un cliente', cliente?.campanas ?? [], !cliente, (v) => setB({ ...b, campana: v, formulario: '' }))}
        </CampoFiltro>
        <CampoFiltro etiqueta="3 · Formulario" htmlFor="repFormulario">
          {selector('repFormulario', b.formulario, campana ? 'Selecciona…' : 'Elige una campaña', campana?.formularios ?? [], !campana, (v) => setB({ ...b, formulario: v }))}
        </CampoFiltro>
        <CampoFiltro etiqueta="Desde" htmlFor="repDesde"><TextField id="repDesde" type="date" fullWidth required value={b.desde} onChange={(e) => setB({ ...b, desde: e.target.value })} /></CampoFiltro>
        <CampoFiltro etiqueta="Hasta" htmlFor="repHasta"><TextField id="repHasta" type="date" fullWidth required value={b.hasta} onChange={(e) => setB({ ...b, hasta: e.target.value })} /></CampoFiltro>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button type="submit" variant="contained" disabled={!listo} loading={ocupado} sx={{ flex: 1, height: 42 }}>Buscar</Button>
          <Button variant="outlined" color="inherit" onClick={onLimpiar} sx={{ height: 42, borderColor: '#c4c8d0', color: '#5b6475', bgcolor: '#fff' }}>Limpiar</Button>
        </Box>
      </Box>
    </TarjetaFiltros>
  );
}

function Vacio({ sinArbol }: { sinArbol: boolean }) {
  return (
    <Box sx={{ py: 9, px: 3, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.25, color: MARCA.azul700 }}>
      <TableIcon sx={{ fontSize: 44 }} />
      <Typography sx={{ fontWeight: 600, fontSize: 16, color: 'text.primary' }}>Aún no hay un reporte en pantalla</Typography>
      <Typography sx={{ fontSize: 14, color: '#5b6475', maxWidth: 460 }}>
        Selecciona en orden el cliente, la campaña y el formulario. Las columnas de la tabla se arman a partir de la base de datos y de los campos de ese formulario.
      </Typography>
      {sinArbol && <Typography sx={{ fontSize: 14, color: '#5b6475', maxWidth: 460 }}><strong>No hay formularios asignados a campañas.</strong> Asígnalos desde el Constructor de formularios.</Typography>}
    </Box>
  );
}

export default function ReporteFormulariosPage() {
  const avisos = useAvisos();
  const [params, setParams] = useSearchParams();
  const [descargando, setDescargando] = useState(false);
  const filtro = Object.fromEntries(CLAVES.map((k) => [k, params.get(k) ?? ''])) as Record<Clave, string>;

  const consulta = useQuery({
    queryKey: ['reportes', 'formularios', filtro],
    queryFn: () => api.get<Reporte>('/reportes/formularios', filtro),
    placeholderData: (previo) => previo,
  });

  const aplicar = (cambios: Partial<Record<Clave, string>>) => {
    const siguiente = { ...filtro, p: '', ...cambios };
    setParams(Object.fromEntries(Object.entries(siguiente).filter(([, v]) => v !== '')));
  };

  const exportar = async () => {
    setDescargando(true);
    try {
      await api.descargar('/reportes/formularios/exportar', filtro);
    } catch (e) {
      avisos.error(e);
    } finally {
      setDescargando(false);
    }
  };

  const r = consulta.data;
  const hero = r?.seleccion
    ? <TarjetaHero etiqueta="Formulario consultado" valor={r.seleccion.formulario.nombre} sub={r.etiqueta} periodo={periodo(r.desde, r.hasta)} />
    : undefined;

  return (
    <Pagina
      miga="Reportes / Formularios dinámicos" titulo="Reporte de formularios"
      subtitulo="Elige cliente, campaña y formulario para ver sus registros y exportarlos a Excel." indicadores={hero}
    >
      <Consulta query={consulta}>
        {(rep) => {
          const nBd = rep.columnas.bd.length;
          const nCampos = rep.columnas.campos.length;
          const grupo = (bg: string) => ({ top: 0, height: 34, py: '6px', px: '14px', color: '#fff', bgcolor: `${bg} !important`, fontSize: 12, fontWeight: 600, letterSpacing: '.3px', textTransform: 'none', borderRight: '2px solid #fff' });
          const desde = (rep.pagina - 1) * rep.porPagina;
          return (
            <>
              <Filtros
                key={`${filtro.cliente}-${filtro.campana}-${filtro.formulario}-${filtro.desde}-${filtro.hasta}`} r={rep} ocupado={consulta.isFetching}
                aplicado={{ cliente: filtro.cliente, campana: filtro.campana, formulario: filtro.formulario, desde: filtro.desde, hasta: filtro.hasta }}
                onBuscar={(b) => aplicar(b)} onLimpiar={() => setParams({})}
              />
              <TarjetaDatos>
                {!rep.seleccion ? <Vacio sinArbol={rep.arbol.length === 0} /> : (
                  <>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, px: 3, py: 2, borderBottom: 1, borderColor: 'divider' }}>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
                        <Typography><Box component="strong" sx={{ fontSize: 18 }}>{numero(rep.total)}</Box> registro{rep.total === 1 ? '' : 's'}</Typography>
                        <Box component="span" sx={{ fontSize: 12, fontWeight: 600, bgcolor: '#f1f4fa', borderRadius: '20px', px: 1.5, py: 0.5 }}>{2 + nBd + nCampos} columnas</Box>
                        {rep.versionVigente != null && <Box component="span" sx={{ fontSize: 12, fontWeight: 600, bgcolor: '#fdf0cf', color: '#8a5a00', borderRadius: '20px', px: 1.5, py: 0.5 }}>Versión vigente v{rep.versionVigente}</Box>}
                      </Box>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 13, color: '#5b6475' }}>
                          <label htmlFor="repTamano">Filas por página</label>
                          <TextField id="repTamano" select size="small" value={String(rep.porPagina)} onChange={(e) => aplicar({ n: e.target.value })}>
                            {REPORTE_FILAS_POR_PAGINA.map((n) => <MenuItem key={n} value={String(n)}>{n}</MenuItem>)}
                          </TextField>
                        </Box>
                        {rep.total > 0 && (
                          <Button
                            variant="contained" startIcon={<ExcelIcon />} onClick={() => void exportar()} loading={descargando}
                            sx={{ height: 42, px: 2.25, bgcolor: '#1e7e40', '&:hover': { bgcolor: '#17663a' } }}
                          >
                            Exportar a Excel
                          </Button>
                        )}
                      </Box>
                    </Box>

                    {rep.filas.length === 0 ? <Box sx={{ textAlign: 'center', color: '#6b7280', p: '40px 24px' }}>No hay registros con estos filtros.</Box> : (
                      <>
                        <TableContainer sx={{ maxHeight: 560, opacity: consulta.isFetching ? 0.6 : 1 }}>
                          <Table
                            stickyHeader
                            sx={{
                              '& td, & th': { fontSize: 13.5, p: '10px 14px', verticalAlign: 'top' },
                              '& thead tr:nth-of-type(2) th': { top: 34 },
                              '& tbody td': { minWidth: 120, maxWidth: 320, overflowWrap: 'anywhere' },
                              '& tbody tr:nth-of-type(even) td': { bgcolor: '#fafbfe' },
                              '& tbody tr:hover td': { bgcolor: '#f3f6fd' },
                            }}
                          >
                            <TableHead>
                              <TableRow>
                                <TableCell colSpan={2} sx={grupo(MARCA.azul900)}>Gestión</TableCell>
                                {nBd > 0 && <TableCell colSpan={nBd} sx={grupo(MARCA.azul600)}>Datos de la búsqueda</TableCell>}
                                {nCampos > 0 && <TableCell colSpan={nCampos} sx={grupo(MARCA.azul700)}>Formulario · {rep.seleccion.formulario.nombre}</TableCell>}
                              </TableRow>
                              <TableRow>
                                <TableCell>Fecha</TableCell>
                                <TableCell>Operador</TableCell>
                                {rep.columnas.bd.map((c) => <TableCell key={`bd-${c.k}`}>{c.label}</TableCell>)}
                                {rep.columnas.campos.map((c) => <TableCell key={`c-${c.k}`}>{c.label}</TableCell>)}
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {rep.filas.map((f) => (
                                <TableRow key={f.id}>
                                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{fechaHoraCorta(f.fecha)}</TableCell>
                                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{f.operador || f.usuario}</TableCell>
                                  {rep.columnas.bd.map((c) => <TableCell key={`bd-${c.k}`}>{f.bd[c.k]}</TableCell>)}
                                  {rep.columnas.campos.map((c) => <TableCell key={`c-${c.k}`}>{f.campos[c.k]}</TableCell>)}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                        <Box component="nav" aria-label="Paginación" sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, px: 3, py: 1.75, borderTop: 1, borderColor: 'divider' }}>
                          <Typography sx={{ fontSize: 13.5, color: '#5b6475' }}>
                            Mostrando <Box component="strong" sx={{ color: 'text.primary' }}>{numero(desde + 1)}–{numero(Math.min(rep.total, desde + rep.porPagina))}</Box> de {numero(rep.total)}
                          </Typography>
                          <Pagination count={rep.totalPaginas} page={rep.pagina} onChange={(_e, p) => aplicar({ p: String(p) })} size="small" color="primary" shape="rounded" showFirstButton={false} />
                        </Box>
                      </>
                    )}
                  </>
                )}
              </TarjetaDatos>
            </>
          );
        }}
      </Consulta>
    </Pagina>
  );
}
