/**
 * Generación y descarga del XML de ventas con el diseño de `views/xml/index.php`:
 * dos tarjetas de hasta 1000px — «Generar XML» (servicio, fecha, botón y avisos)
 * y «Descargar XML» (servicio → archivo y botón «Descargar»).
 */
import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, Grid, MenuItem, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../shared/api.ts';
import { CampoFiltro, TarjetaFiltros } from '../shared/graficos.tsx';
import { Consulta, Pagina, hoy, useAvisos } from '../shared/ui.tsx';

interface CampanaXml { id: number; etiqueta: string; carpeta: string; archivos: string[] }

const Titulo = ({ children }: { children: string }) => <Typography sx={{ fontWeight: 600, fontSize: 18, mb: 2 }}>{children}</Typography>;

function SelectorServicio({ id, valor, lista, onCambio }: { id: string; valor: string; lista: CampanaXml[]; onCambio: (v: string) => void }) {
  return (
    <TextField id={id} select fullWidth value={valor} onChange={(e) => onCambio(e.target.value)} slotProps={{ select: { displayEmpty: true } }}>
      <MenuItem value="" disabled>Seleccione...</MenuItem>
      {lista.map((c) => <MenuItem key={c.id} value={String(c.id)}>{c.etiqueta}</MenuItem>)}
    </TextField>
  );
}

export default function XmlPage() {
  const avisos = useAvisos();
  const cache = useQueryClient();
  const [fecha, setFecha] = useState(hoy());
  const [servicioId, setServicioId] = useState('');
  const [dServicio, setDServicio] = useState('');
  const [archivo, setArchivo] = useState('');
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);
  const campanas = useQuery({ queryKey: ['xml'], queryFn: () => api.get<CampanaXml[]>('/xml') });

  const generar = useMutation({
    mutationFn: () => api.post<{ archivo: string; operaciones: number }>('/xml', { fecha, servicio_id: servicioId }),
    onMutate: () => setResultado(null),
    onSuccess: (r) => {
      setResultado({ ok: true, texto: `XML generado: ${r.archivo} (${r.operaciones} operaciones).` });
      void cache.invalidateQueries({ queryKey: ['xml'] });
    },
    onError: (e) => setResultado({ ok: false, texto: e instanceof Error ? e.message : 'No se pudo generar el XML.' }),
  });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (servicioId === '') { avisos.error('Por favor seleccione un servicio.'); return; }
    generar.mutate();
  };
  const descargar = (carpeta: string, nombre: string) => {
    api.descargar(`/xml/archivos/${encodeURIComponent(carpeta)}/${encodeURIComponent(nombre)}`).catch((e: unknown) => avisos.error(e));
  };

  return (
    <Pagina miga="Reportes / Generar XML" titulo="Generar XML" subtitulo="Archivo de ventas para el sistema externo. Cada generación consume numeración de transacciones.">
      <Consulta query={campanas}>
        {(lista) => {
          const elegido = lista.find((c) => String(c.id) === dServicio);
          return (
            <Box sx={{ maxWidth: 1000 }}>
              <TarjetaFiltros>
                <Titulo>Generar XML</Titulo>
                <Grid container spacing={2} component="form" onSubmit={enviar} sx={{ alignItems: 'flex-end' }}>
                  <Grid size={{ xs: 12, md: 5 }}>
                    <CampoFiltro etiqueta="Servicio" htmlFor="servicio_id"><SelectorServicio id="servicio_id" valor={servicioId} lista={lista} onCambio={setServicioId} /></CampoFiltro>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <CampoFiltro etiqueta="Fecha" htmlFor="fecha_d"><TextField id="fecha_d" type="date" fullWidth required value={fecha} onChange={(e) => setFecha(e.target.value)} /></CampoFiltro>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Button type="submit" variant="contained" fullWidth loading={generar.isPending} sx={{ height: 42 }}>Generar XML</Button>
                  </Grid>
                </Grid>
                {resultado && <Alert severity={resultado.ok ? 'success' : 'error'} sx={{ mt: 2 }}>{resultado.texto}</Alert>}
                <Alert severity="info" sx={{ mt: 2 }}>Generar dos veces la misma fecha produce un archivo nuevo con numeración nueva: hazlo solo cuando corresponda.</Alert>
              </TarjetaFiltros>

              <TarjetaFiltros>
                <Titulo>Descargar XML</Titulo>
                <Grid container spacing={2} sx={{ alignItems: 'flex-end' }}>
                  <Grid size={{ xs: 12, md: 5 }}>
                    <CampoFiltro etiqueta="Servicio" htmlFor="servicio_xml">
                      <SelectorServicio id="servicio_xml" valor={dServicio} lista={lista} onCambio={(v) => { setDServicio(v); setArchivo(''); }} />
                    </CampoFiltro>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <CampoFiltro etiqueta="Archivo" htmlFor="archivo_xml">
                      <TextField
                        id="archivo_xml" select fullWidth value={archivo} disabled={!elegido} onChange={(e) => setArchivo(e.target.value)}
                        slotProps={{ select: { displayEmpty: true } }}
                      >
                        <MenuItem value="" disabled>{elegido && elegido.archivos.length === 0 ? 'Sin archivos generados' : 'Seleccione...'}</MenuItem>
                        {(elegido?.archivos ?? []).map((a) => <MenuItem key={a} value={a} sx={{ fontFamily: 'monospace', fontSize: 13 }}>{a}</MenuItem>)}
                      </TextField>
                    </CampoFiltro>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button variant="contained" sx={{ flex: 1, height: 42 }} disabled={!elegido || archivo === ''} onClick={() => elegido && descargar(elegido.carpeta, archivo)}>Descargar</Button>
                      <Button
                        variant="outlined" sx={{ height: 42 }} disabled={!elegido || archivo === ''} title="Descargar el MD5SUM"
                        onClick={() => elegido && descargar(elegido.carpeta, archivo.replace('_bulk_sales.xml', '_MD5SUM'))}
                      >
                        MD5
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </TarjetaFiltros>
            </Box>
          );
        }}
      </Consulta>
    </Pagina>
  );
}
