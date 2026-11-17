/**
 * Reporte de formularios dinámicos: cliente → campaña → formulario, por rango de
 * fechas, paginado y exportable a Excel. Los filtros viven en la URL.
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Box, Button, Chip, Grid, Pagination, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import DownloadIcon from '@mui/icons-material/DownloadOutlined';
import { useQuery } from '@tanstack/react-query';
import { REPORTE_FILAS_POR_PAGINA } from '@bulkapp/shared';
import { api } from '../shared/api.ts';
import { CampoFecha, Consulta, Pagina, Seccion, Selector, Vacio, numero, useAvisos } from '../shared/ui.tsx';

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

  /** Cambiar un filtro reinicia los que dependen de él y vuelve a la página 1. */
  const cambiar = (cambios: Partial<Record<Clave, string>>) => {
    const siguiente = { ...filtro, p: '', ...cambios };
    setParams(Object.fromEntries(Object.entries(siguiente).filter(([, v]) => v !== '')), { replace: true });
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

  return (
    <Pagina titulo="Reporte de formularios dinámicos" subtitulo="Registros capturados con los formularios del Constructor.">
      <Consulta query={consulta}>
        {(r) => {
          const cliente = r.arbol.find((c) => String(c.id) === filtro.cliente);
          const campana = cliente?.campanas.find((c) => String(c.id) === filtro.campana);
          return (
            <Stack spacing={3}>
              <Seccion>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <Selector
                      label="Cliente" value={cliente ? filtro.cliente : ''} vacio="Selecciona…" opciones={r.arbol.map((c) => ({ value: String(c.id), label: c.nombre }))}
                      onChange={(e) => cambiar({ cliente: e.target.value, campana: '', formulario: '' })}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <Selector
                      label="Campaña" value={campana ? filtro.campana : ''} vacio="Selecciona…" disabled={!cliente}
                      opciones={(cliente?.campanas ?? []).map((c) => ({ value: String(c.id), label: c.nombre }))}
                      onChange={(e) => cambiar({ campana: e.target.value, formulario: '' })}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <Selector
                      label="Formulario" value={r.seleccion ? filtro.formulario : ''} vacio="Selecciona…" disabled={!campana}
                      opciones={(campana?.formularios ?? []).map((f) => ({ value: String(f.id), label: f.nombre }))}
                      onChange={(e) => cambiar({ formulario: e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}><CampoFecha label="Desde" value={r.desde} onChange={(e) => cambiar({ desde: e.target.value, hasta: r.hasta })} /></Grid>
                  <Grid size={{ xs: 6, md: 3 }}><CampoFecha label="Hasta" value={r.hasta} onChange={(e) => cambiar({ hasta: e.target.value, desde: r.desde })} /></Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <Selector
                      label="Filas por página" value={String(r.porPagina)} opciones={REPORTE_FILAS_POR_PAGINA.map((n) => ({ value: String(n), label: String(n) }))}
                      onChange={(e) => cambiar({ n: e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <Button fullWidth variant="outlined" startIcon={<DownloadIcon />} onClick={() => void exportar()} loading={descargando} disabled={!r.seleccion || r.total === 0}>
                      Exportar Excel
                    </Button>
                  </Grid>
                </Grid>
              </Seccion>

              {!r.seleccion ? (
                <Vacio>{r.arbol.length === 0 ? 'Aún no hay formularios dinámicos asignados a campañas.' : 'Elige cliente, campaña y formulario para ver los registros.'}</Vacio>
              ) : (
                <Seccion
                  titulo={`${numero(r.total)} registros`}
                  acciones={(
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                      <Chip size="small" label={r.etiqueta} />
                      {r.versionVigente != null && <Chip size="small" variant="outlined" label={`Versión vigente v${r.versionVigente}`} />}
                    </Stack>
                  )}
                >
                  {r.filas.length === 0 ? <Vacio>No hay registros en el período consultado.</Vacio> : (
                    <>
                      <TableContainer sx={{ maxHeight: '62vh', opacity: consulta.isFetching ? 0.6 : 1 }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              {['ID', 'Fecha', 'Operador'].map((t) => <TableCell key={t}>{t}</TableCell>)}
                              {r.columnas.bd.map((c) => <TableCell key={`bd-${c.k}`} sx={{ bgcolor: 'grey.100' }}>{c.label}</TableCell>)}
                              {r.columnas.campos.map((c) => <TableCell key={`c-${c.k}`} sx={{ color: 'primary.dark' }}>{c.label}</TableCell>)}
                              <TableCell>Versión</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {r.filas.map((f) => (
                              <TableRow key={f.id} hover>
                                <TableCell>{f.id}</TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>{f.fecha}</TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>{f.operador}</TableCell>
                                {r.columnas.bd.map((c) => <TableCell key={`bd-${c.k}`}>{f.bd[c.k]}</TableCell>)}
                                {r.columnas.campos.map((c) => <TableCell key={`c-${c.k}`} sx={{ maxWidth: 320, overflowWrap: 'anywhere' }}>{f.campos[c.k]}</TableCell>)}
                                <TableCell>v{f.version}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                        <Typography variant="caption" color="text.secondary">Página {r.pagina} de {r.totalPaginas}</Typography>
                        <Pagination count={r.totalPaginas} page={r.pagina} onChange={(_e, p) => cambiar({ p: String(p) })} size="small" color="primary" />
                      </Box>
                    </>
                  )}
                </Seccion>
              )}
            </Stack>
          );
        }}
      </Consulta>
    </Pagina>
  );
}
