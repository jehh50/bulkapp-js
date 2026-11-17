/**
 * Generación y descarga del XML de ventas (bulk_sales) por campaña y fecha.
 */
import { useState, type FormEvent } from 'react';
import { Alert, Button, Grid, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../shared/api.ts';
import { CampoFecha, Consulta, Pagina, Seccion, Selector, Vacio, hoy, useAvisos } from '../shared/ui.tsx';

interface CampanaXml { id: number; etiqueta: string; carpeta: string; archivos: string[] }

export default function XmlPage() {
  const avisos = useAvisos();
  const cache = useQueryClient();
  const [fecha, setFecha] = useState(hoy());
  const [servicioId, setServicioId] = useState('');
  const campanas = useQuery({ queryKey: ['xml'], queryFn: () => api.get<CampanaXml[]>('/xml') });

  const generar = useMutation({
    mutationFn: () => api.post<{ archivo: string; operaciones: number }>('/xml', { fecha, servicio_id: servicioId }),
    onSuccess: (r) => {
      avisos.ok(`XML generado: ${r.archivo} (${r.operaciones} operaciones).`);
      void cache.invalidateQueries({ queryKey: ['xml'] });
    },
    onError: (e) => avisos.error(e),
  });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    generar.mutate();
  };
  const descargar = (carpeta: string, archivo: string) => {
    api.descargar(`/xml/archivos/${encodeURIComponent(carpeta)}/${encodeURIComponent(archivo)}`).catch((e: unknown) => avisos.error(e));
  };

  return (
    <Pagina titulo="Generar XML" subtitulo="Archivo de ventas para el sistema externo. Cada generación consume numeración de transacciones.">
      <Consulta query={campanas}>
        {(lista) => (
          <Stack spacing={3}>
            <Seccion titulo="Nueva generación">
              <Grid container spacing={2} component="form" onSubmit={enviar} sx={{ alignItems: 'center' }}>
                <Grid size={{ xs: 12, sm: 4, md: 3 }}><CampoFecha label="Fecha de venta" value={fecha} required onChange={(e) => setFecha(e.target.value)} /></Grid>
                <Grid size={{ xs: 12, sm: 5, md: 4 }}>
                  <Selector label="Campaña" required value={servicioId} vacio="Selecciona…" opciones={lista.map((c) => ({ value: String(c.id), label: c.etiqueta }))} onChange={(e) => setServicioId(e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 3, md: 2 }}><Button type="submit" variant="contained" fullWidth disabled={servicioId === ''} loading={generar.isPending}>Generar</Button></Grid>
              </Grid>
              <Alert severity="info" sx={{ mt: 2 }}>Generar dos veces la misma fecha produce un archivo nuevo con numeración nueva: hazlo solo cuando corresponda.</Alert>
            </Seccion>

            <Grid container spacing={3}>
              {lista.map((c) => (
                <Grid key={c.id} size={{ xs: 12, md: 6 }}>
                  <Seccion titulo={c.etiqueta} sx={{ height: '100%' }}>
                    {c.archivos.length === 0 ? <Vacio>Sin archivos generados.</Vacio> : (
                      <List dense disablePadding sx={{ maxHeight: 320, overflowY: 'auto' }}>
                        {c.archivos.map((a) => (
                          <ListItem
                            key={a} disableGutters divider
                            secondaryAction={(
                              <Stack direction="row" spacing={0.5}>
                                <Button size="small" onClick={() => descargar(c.carpeta, a)}>XML</Button>
                                <Button size="small" onClick={() => descargar(c.carpeta, a.replace('_bulk_sales.xml', '_MD5SUM'))}>MD5</Button>
                              </Stack>
                            )}
                          >
                            <ListItemText primary={<Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{a}</Typography>} />
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </Seccion>
                </Grid>
              ))}
            </Grid>
          </Stack>
        )}
      </Consulta>
    </Pagina>
  );
}
