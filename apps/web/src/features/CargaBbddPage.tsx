/**
 * Carga de base de datos con el diseño de `views/carga_archivo/index.php`: tarjeta de
 * 640px con borde dorado, aviso del formato con enlace al archivo modelo, servicio y
 * caja de archivo punteada («Examinar…» pasa a dorado al elegir el CSV).
 */
import { useRef, useState, type FormEvent } from 'react';
import { Box, Button, ButtonBase, Link, MenuItem, TextField, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { CARGA_COLUMNAS_CLIENTES, CARGA_MAX_BYTES_CLIENTES, FLUJO } from '@bulkapp/shared';
import { api, mensajeDe } from '../shared/api.ts';
import { useCampanas } from '../shared/datos.tsx';
import { AccionesForm, Aviso, AvisoInfo, ErrorForm, Etiqueta, TarjetaConfig, TituloTarjeta } from '../shared/config.tsx';
import { MARCA } from '../shared/tema.ts';
import { Pagina, numero, useAvisos } from '../shared/ui.tsx';

export default function CargaBbddPage() {
  const avisos = useAvisos();
  const campanas = useCampanas({ flujo: FLUJO.BANCARIO, activas: true });
  const entrada = useRef<HTMLInputElement>(null);
  const [servicioId, setServicioId] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const subir = useMutation({
    mutationFn: () => {
      const datos = new FormData();
      datos.set('servicio_id', servicioId);
      if (archivo) datos.set('archivo', archivo);
      return api.post<{ insertadas: number; omitidas: number }>('/admin/cargas-clientes', datos);
    },
    onMutate: () => setResultado(null),
    onSuccess: (r) => {
      setResultado({ tipo: 'ok', texto: `¡Éxito! El archivo se ha procesado correctamente: ${numero(r.insertadas)} clientes cargados${r.omitidas > 0 ? `, ${numero(r.omitidas)} filas omitidas por columnas incompletas` : ''}.` });
      setArchivo(null);
      if (entrada.current) entrada.current.value = '';
    },
    onError: (e) => setResultado({ tipo: 'error', texto: mensajeDe(e) }),
  });

  const elegir = (f: File | null) => {
    setResultado(null);
    if (f && !f.name.toLowerCase().endsWith('.csv')) {
      setError('Extensión incorrecta. Solo se permite .csv');
      setArchivo(null);
      return;
    }
    setError(null);
    setArchivo(f);
  };
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (servicioId === '') setError('Seleccione el servicio.');
    else if (!archivo) setError('No se ha seleccionado ningún archivo');
    else if (archivo.size > CARGA_MAX_BYTES_CLIENTES) setError('El archivo supera el tamaño máximo (10 MB).');
    else { setError(null); subir.mutate(); }
  };
  const modelo = () => { api.descargar('/admin/cargas-clientes/modelo').catch((e: unknown) => avisos.error(e)); };

  return (
    <Pagina miga="Configuración / Carga BBDD" titulo="Carga de base de datos" subtitulo="Importa masivamente clientes desde archivos CSV por cada servicio.">
      <Box sx={{ maxWidth: 640, mx: 'auto' }}>
        {resultado && <Aviso tipo={resultado.tipo} onCerrar={() => setResultado(null)}>{resultado.texto}</Aviso>}
        <TarjetaConfig borde={MARCA.dorado} sx={{ gap: 2.25 }}>
          <TituloTarjeta titulo="Importar CSV" sub="Selecciona el servicio y carga el archivo de la base de clientes." />
          <AvisoInfo>
            Solo se aceptan archivos con extensión <strong>.csv</strong> (delimitado por <strong>;</strong>). Puedes descargar el{' '}
            <Link component="button" type="button" onClick={modelo} sx={{ verticalAlign: 'baseline', fontSize: 'inherit' }}>archivo modelo</Link>.
          </AvisoInfo>

          <Box component="form" onSubmit={enviar} noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Etiqueta texto="Servicio" htmlFor="cargaServicio">
              <TextField id="cargaServicio" select value={servicioId} onChange={(e) => setServicioId(e.target.value)} slotProps={{ select: { displayEmpty: true } }}>
                <MenuItem value="" disabled>Seleccione…</MenuItem>
                {(campanas.data ?? []).map((c) => <MenuItem key={c.id} value={String(c.id)}>{c.etiqueta}</MenuItem>)}
              </TextField>
            </Etiqueta>

            <Etiqueta texto="Archivo" htmlFor="cargaArchivo" ayuda={`Columnas en orden: ${CARGA_COLUMNAS_CLIENTES.join(', ')}.`}>
              <ButtonBase
                component="div" onClick={() => entrada.current?.click()}
                sx={{ display: 'flex', alignItems: 'center', gap: 1.5, border: '1px dashed #d1d5db', borderRadius: '10px', p: '14px 16px', bgcolor: '#fdf6e4', textAlign: 'left', fontFamily: 'inherit', justifyContent: 'flex-start' }}
              >
                <Box sx={{ flex: '0 0 42px', height: 42, borderRadius: '50%', bgcolor: MARCA.azul700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }} aria-hidden>⇪</Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, overflowWrap: 'anywhere' }}>{archivo ? archivo.name : 'Adjunte el archivo'}</Typography>
                  <Typography sx={{ fontSize: 12.5, color: '#6b7280' }}>{archivo ? `${numero(Math.ceil(archivo.size / 1024))} KB` : 'Formato .csv separado por punto y coma'}</Typography>
                </Box>
                <Box
                  component="span"
                  sx={{
                    ml: 'auto', display: 'inline-flex', alignItems: 'center', height: 44, px: 2.25, borderRadius: '10px', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap',
                    ...(archivo ? { bgcolor: MARCA.dorado, color: MARCA.tinta } : { bgcolor: MARCA.azul700, color: '#fff' }),
                  }}
                >
                  Examinar…
                </Box>
                <input ref={entrada} id="cargaArchivo" type="file" hidden accept=".csv" onChange={(e) => elegir(e.target.files?.[0] ?? null)} />
              </ButtonBase>
            </Etiqueta>

            {error && <ErrorForm>{error}</ErrorForm>}
            <AccionesForm>
              <Button type="submit" variant="contained" loading={subir.isPending} loadingPosition="start">{subir.isPending ? 'Procesando…' : 'Subir archivo'}</Button>
            </AccionesForm>
          </Box>
        </TarjetaConfig>
      </Box>
    </Pagina>
  );
}
