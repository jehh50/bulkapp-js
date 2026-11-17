/**
 * Captura con el formulario dinámico de la campaña activa. Si el formulario tiene
 * base de datos, primero se busca el registro y cada registro admite un solo envío.
 */
import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, Grid, Stack, TextField, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useMutation, useQuery } from '@tanstack/react-query';
import { validarValores, valorComoTexto, type ColumnaCarga, type Definicion, type ValorCampo, type Valores } from '@bulkapp/shared';
import { ApiError, api } from '../shared/api.ts';
import { Consulta, Pagina, Seccion, useAvisos } from '../shared/ui.tsx';
import { CampoDinamico, camposVisibles } from './CampoDinamico.tsx';

interface Formulario { id: number; nombre: string; btn_texto: string; version: number; definicion: Definicion }
interface Bd { id: number; busqueda: string; columnas: ColumnaCarga[] }
interface Respuesta { formulario: Formulario | null; bd: Bd | null }
type Busqueda = { estado: 'no_encontrado' | 'atendido' } | { estado: 'encontrado'; registro: { id: number; datos: Record<string, unknown> } };

export default function CapturaDinamicaPage() {
  const consulta = useQuery({ queryKey: ['captura', 'formulario'], queryFn: () => api.get<Respuesta>('/captura/formulario') });
  return (
    <Consulta query={consulta}>
      {({ formulario, bd }) => (formulario
        ? <Captura key={formulario.id} formulario={formulario} bd={bd} />
        : (
          <Pagina titulo="Formulario de gestión">
            <Alert severity="info">Tu campaña aún no tiene un formulario activo. Pide a un administrador que lo asigne desde el Constructor.</Alert>
          </Pagina>
        ))}
    </Consulta>
  );
}

function Captura({ formulario, bd }: { formulario: Formulario; bd: Bd | null }) {
  const avisos = useAvisos();
  const [clave, setClave] = useState('');
  const [busqueda, setBusqueda] = useState<Busqueda | null>(null);
  const [valores, setValores] = useState<Valores>({});
  const [errores, setErrores] = useState<Record<string, string>>({});

  const registro = busqueda?.estado === 'encontrado' ? busqueda.registro : null;
  const etiquetaBusqueda = bd?.columnas.find((c) => c.k === bd.busqueda)?.label ?? 'Dato de búsqueda';

  const limpiar = () => {
    setBusqueda(null);
    setValores({});
    setErrores({});
    setClave('');
  };

  const buscar = useMutation({
    mutationFn: (valor: string) => api.get<Busqueda>('/captura/buscar', { clave: valor }),
    onSuccess: (r) => {
      setBusqueda(r);
      setValores({});
      setErrores({});
    },
    onError: (e) => avisos.error(e),
  });

  const guardar = useMutation({
    mutationFn: (limpios: Valores) => api.post<{ id: number }>('/captura/envios', { valores: limpios, fila_id: registro?.id }),
    onSuccess: () => {
      avisos.ok('Registro guardado.');
      limpiar();
    },
    onError: (e) => {
      if (e instanceof ApiError) setErrores(e.porCampo);
      if (e instanceof ApiError && e.code === 'registro_atendido') limpiar();
      avisos.error(e);
    },
  });

  const cambiar = (k: string, valor: ValorCampo) => {
    setValores((previo) => ({ ...previo, [k]: valor }));
    setErrores((previo) => {
      if (!(k in previo)) return previo;
      const { [k]: _quitado, ...resto } = previo;
      return resto;
    });
  };

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const validacion = validarValores(formulario.definicion, valores);
    if (!validacion.ok) {
      setErrores(validacion.errores);
      avisos.error('Revisa los campos marcados.');
      return;
    }
    guardar.mutate(validacion.valores);
  };

  const puedeCapturar = bd === null || registro !== null;

  return (
    <Pagina titulo={formulario.nombre} subtitulo={bd ? `Busca el registro por «${etiquetaBusqueda}» y completa el formulario.` : 'Completa el formulario y guarda la gestión.'}>
      <Stack spacing={3}>
        {bd && (
          <Seccion titulo="Buscar registro">
            <Stack
              component="form" direction={{ xs: 'column', sm: 'row' }} spacing={1.5}
              onSubmit={(e) => { e.preventDefault(); if (clave.trim() !== '') buscar.mutate(clave.trim()); }}
            >
              <TextField label={etiquetaBusqueda} value={clave} onChange={(e) => setClave(e.target.value)} sx={{ flex: 1, maxWidth: 420 }} slotProps={{ htmlInput: { maxLength: 191 } }} autoFocus />
              <Button type="submit" variant="contained" startIcon={<SearchIcon />} loading={buscar.isPending}>Buscar</Button>
              {busqueda && <Button onClick={limpiar}>Limpiar</Button>}
            </Stack>
            {busqueda?.estado === 'no_encontrado' && <Alert severity="warning" sx={{ mt: 2 }}>No se encontró ningún registro con ese dato.</Alert>}
            {busqueda?.estado === 'atendido' && <Alert severity="info" sx={{ mt: 2 }}>Este registro ya fue atendido.</Alert>}
            {registro && (
              <Grid container spacing={2} sx={{ mt: 1 }}>
                {bd.columnas.map((c) => (
                  <Grid key={c.k} size={{ xs: 12, sm: 6, md: 3 }}>
                    <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500, overflowWrap: 'anywhere' }}>{valorComoTexto(registro.datos[c.k]) || '—'}</Typography>
                  </Grid>
                ))}
              </Grid>
            )}
          </Seccion>
        )}

        {puedeCapturar && (
          <Seccion titulo={bd ? 'Gestión' : undefined}>
            <Box component="form" onSubmit={enviar} noValidate>
              <Stack spacing={2.5} sx={{ maxWidth: 720 }}>
                {camposVisibles(formulario.definicion, valores).map((c) => (
                  <CampoDinamico key={c.k} campo={c} valor={valores[c.k]} error={errores[c.k]} onChange={(v) => cambiar(c.k, v)} />
                ))}
                <Stack direction="row" spacing={1.5}>
                  <Button type="submit" variant="contained" size="large" loading={guardar.isPending}>{formulario.btn_texto || 'Guardar'}</Button>
                  <Button size="large" onClick={limpiar} disabled={guardar.isPending}>Limpiar</Button>
                </Stack>
              </Stack>
            </Box>
          </Seccion>
        )}
      </Stack>
    </Pagina>
  );
}
