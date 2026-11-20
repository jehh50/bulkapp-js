/**
 * Edición de resultados con el diseño de `views/configuracion/editarResultado.php` +
 * `edit.js`: búsqueda por cédula con «Buscar» y «Limpiar», contador de registros y
 * un acordeón por venta con el formulario en línea (Regresar · Guardar · Eliminar),
 * ambos con confirmación.
 */
import { useState, type FormEvent, type ReactNode } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Box, Button, Grid, MenuItem, Paper, TextField, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useMutation, useQuery } from '@tanstack/react-query';
import { GENEROS, mascaraTelefonoBanca } from '@bulkapp/shared';
import { ApiError, api, mensajeDe } from '../shared/api.ts';
import { Aviso, ErrorForm, Ficha, PildoraServicio, TarjetaConfig, TituloTarjeta } from '../shared/config.tsx';
import { MARCA } from '../shared/tema.ts';
import { Confirmacion, Pagina, fechaLarga } from '../shared/ui.tsx';

interface Venta {
  id: number; nombre: string; apellido: string; genero: string; fecha_nacimiento: string | null; cedula: string; telf_hab: string; telf_celular: string;
  correo: string; cuenta: string; servicio: string; servicio_id: number; producto_id: number; producto: string; fecha_venta: string;
}
type Mensaje = { tipo: 'ok' | 'error'; texto: string };
type CampoTexto = 'nombre' | 'apellido' | 'cedula' | 'telf_hab' | 'telf_celular' | 'correo' | 'cuenta';

const etiqueta = { fontSize: 13, color: '#6b7280', mb: 0.5 } as const;

function FormVenta({ venta, onVolver, onListo }: { venta: Venta; onVolver: () => void; onListo: (m: Mensaje) => void }) {
  const [v, setV] = useState({ ...venta, fecha_nacimiento: venta.fecha_nacimiento ?? '', producto_id: String(venta.producto_id) });
  const [confirmar, setConfirmar] = useState<'guardar' | 'eliminar' | null>(null);
  const productos = useQuery({
    queryKey: ['reportes', 'productos', venta.servicio_id],
    queryFn: () => api.get<Array<{ id: number; descripcion: string }>>('/reportes/productos', { servicio_id: venta.servicio_id }),
  });
  const guardar = useMutation({
    mutationFn: () => api.put(`/admin/ventas/${venta.id}`, v),
    onSuccess: () => { setConfirmar(null); onListo({ tipo: 'ok', texto: 'Registro actualizado correctamente.' }); },
    onError: () => setConfirmar(null),
  });
  const eliminar = useMutation({
    mutationFn: () => api.delete(`/admin/ventas/${venta.id}`),
    onSuccess: () => { setConfirmar(null); onListo({ tipo: 'ok', texto: 'Registro eliminado correctamente.' }); },
    onError: (e) => { setConfirmar(null); onListo({ tipo: 'error', texto: mensajeDe(e) }); },
  });
  const errores = guardar.error instanceof ApiError ? guardar.error.porCampo : {};
  // El producto de la venta puede estar ya inactivo: se conserva como opción.
  const opciones = [
    ...(productos.data?.some((p) => p.id === venta.producto_id) === false ? [{ id: venta.producto_id, descripcion: `${venta.producto} (inactivo)` }] : []),
    ...(productos.data ?? []),
  ];
  const campo = (titulo: string, control: ReactNode) => (
    <Grid size={{ xs: 12, md: 6, lg: 4 }}>
      <Typography component="div" sx={etiqueta}>{titulo}</Typography>
      {control}
    </Grid>
  );
  const texto = (k: CampoTexto, titulo: string, o: { telefono?: boolean; placeholder?: string; max?: number } = {}) => campo(titulo, (
    <TextField
      fullWidth value={v[k]} placeholder={o.placeholder} error={k in errores} helperText={errores[k]}
      onChange={(e) => setV({ ...v, [k]: o.telefono ? mascaraTelefonoBanca(e.target.value) : e.target.value })}
      slotProps={{ htmlInput: { maxLength: o.max ?? 50, 'aria-label': titulo } }}
    />
  ));
  const fecha = (k: 'fecha_nacimiento' | 'fecha_venta', titulo: string) => campo(titulo, (
    <TextField fullWidth type="date" value={v[k]} error={k in errores} helperText={errores[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} slotProps={{ htmlInput: { 'aria-label': titulo } }} />
  ));

  return (
    <>
      <Grid container spacing={2}>
        {campo('Producto', (
          <TextField select fullWidth value={opciones.length > 0 ? v.producto_id : ''} error={'producto_id' in errores} helperText={errores.producto_id} onChange={(e) => setV({ ...v, producto_id: e.target.value })} slotProps={{ htmlInput: { 'aria-label': 'Producto' } }}>
            {opciones.length === 0 && <MenuItem value="" disabled>Sin productos disponibles</MenuItem>}
            {opciones.map((p) => <MenuItem key={p.id} value={String(p.id)}>{p.descripcion}</MenuItem>)}
          </TextField>
        ))}
        {texto('nombre', 'Nombre')}
        {texto('apellido', 'Apellido')}
        {texto('cedula', 'Cédula', { max: 10 })}
        {campo('Sexo', (
          <TextField select fullWidth value={v.genero} error={'genero' in errores} helperText={errores.genero} onChange={(e) => setV({ ...v, genero: e.target.value })} slotProps={{ select: { displayEmpty: true }, htmlInput: { 'aria-label': 'Sexo' } }}>
            <MenuItem value="" disabled>Seleccione…</MenuItem>
            {GENEROS.map((g) => <MenuItem key={g} value={g}>{g === 'M' ? 'Masculino' : 'Femenino'}</MenuItem>)}
          </TextField>
        ))}
        {fecha('fecha_nacimiento', 'Fecha de nacimiento')}
        {texto('telf_hab', 'Teléfono habitación', { telefono: true, placeholder: '(0212)345.67.89', max: 15 })}
        {texto('telf_celular', 'Teléfono celular', { telefono: true, placeholder: '(0424)234.56.78', max: 15 })}
        {texto('correo', 'Correo electrónico', { placeholder: 'usuario@dominio.com' })}
        {fecha('fecha_venta', 'Fecha de venta')}
        {texto('cuenta', 'Número de cuenta', { placeholder: '12345678901234567890', max: 20 })}
      </Grid>
      {guardar.isError && <Box sx={{ mt: 2 }}><ErrorForm>{mensajeDe(guardar.error)}</ErrorForm></Box>}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 1, borderTop: 1, borderColor: 'divider', pt: 2, mt: 3, '& .MuiButton-root': { flex: { xs: 1, md: 'none' } } }}>
        <Button variant="outlined" onClick={onVolver}>Regresar</Button>
        <Button variant="contained" onClick={() => setConfirmar('guardar')}>Guardar</Button>
        <Button variant="outlined" color="error" onClick={() => setConfirmar('eliminar')}>Eliminar</Button>
      </Box>
      <Confirmacion
        abierto={confirmar === 'guardar'} titulo="Guardar cambios" confirmar="Guardar cambios" ocupado={guardar.isPending}
        texto={<>¿Confirmas la actualización de <strong>{venta.nombre} {venta.apellido}</strong>?</>}
        onCerrar={() => setConfirmar(null)} onConfirmar={() => guardar.mutate()}
      />
      <Confirmacion
        abierto={confirmar === 'eliminar'} titulo="Eliminar venta" peligro confirmar="Eliminar" ocupado={eliminar.isPending}
        texto={<>¿Eliminar la venta de <strong>{venta.nombre} {venta.apellido}</strong> del {fechaLarga(venta.fecha_venta)}? Esta acción no se puede deshacer.</>}
        onCerrar={() => setConfirmar(null)} onConfirmar={() => eliminar.mutate()}
      />
    </>
  );
}

export default function ResultadosPage() {
  const [cedula, setCedula] = useState('');
  const [buscada, setBuscada] = useState('');
  const [abierto, setAbierto] = useState<number | false>(false);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ventas = useQuery({
    queryKey: ['admin', 'ventas', buscada], enabled: buscada !== '',
    queryFn: () => api.get<Venta[]>('/admin/ventas', { cedula: buscada }),
  });

  const buscar = (e: FormEvent) => {
    e.preventDefault();
    if (cedula.trim() === '') { setError('Introduzca un número de cédula válido.'); return; }
    setError(null);
    setMensaje(null);
    if (cedula === buscada) void ventas.refetch();
    setBuscada(cedula);
    setAbierto(false);
  };
  const limpiar = () => { setCedula(''); setBuscada(''); setError(null); setMensaje(null); };
  const lista = buscada ? ventas.data : undefined;
  const primero = lista?.[0]?.id;
  const expandido = abierto === false ? primero : abierto;

  return (
    <Pagina miga="Configuración / Resultados" titulo="Edición de resultados" subtitulo="Busca una venta por cédula para corregir sus datos.">
      <Box sx={{ maxWidth: 1150 }}>
        <TarjetaConfig>
          <TituloTarjeta
            titulo="Edición de resultados" sub="Busca una venta por cédula para corregir los datos del cliente o del producto."
            accion={<Ficha>Administración</Ficha>}
          />
          {mensaje && <Aviso tipo={mensaje.tipo} onCerrar={() => setMensaje(null)}>{mensaje.texto}</Aviso>}
          <Box component="form" onSubmit={buscar} noValidate>
            <Typography component="label" htmlFor="cedula" sx={{ display: 'block', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', mb: 0.75 }}>Cédula del cliente</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <TextField
                id="cedula" value={cedula} placeholder="12658457" sx={{ flex: '1 1 220px', maxWidth: 360 }}
                onChange={(e) => setCedula(e.target.value.replace(/\D+/g, '').slice(0, 10))} slotProps={{ htmlInput: { inputMode: 'numeric', 'aria-describedby': 'cedulaAyuda' } }}
              />
              <Button type="submit" variant="contained" loading={ventas.isFetching} sx={{ px: 3 }}>Buscar</Button>
              <Button variant="outlined" color="inherit" onClick={limpiar} sx={{ borderColor: '#c4c8d0', color: '#5b6475' }}>Limpiar</Button>
            </Box>
            <Typography id="cedulaAyuda" sx={{ fontSize: 13, color: '#6b7280', mt: 0.75 }}>Sin puntos ni guiones.</Typography>
          </Box>
          {error && <ErrorForm>{error}</ErrorForm>}
          {ventas.isError && <ErrorForm>{mensajeDe(ventas.error)}</ErrorForm>}
        </TarjetaConfig>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mt: 3, mb: 1.25 }}>
          <Typography component="h2" sx={{ fontSize: 16, fontWeight: 600 }}>Resultados</Typography>
          <Ficha>{lista?.length ?? 0} registro{lista?.length === 1 ? '' : 's'}</Ficha>
        </Box>

        {lista && lista.length === 0 && (
          <Paper variant="outlined" sx={{ textAlign: 'center', py: 5, px: 2 }}>
            <Typography sx={{ fontSize: 40, color: MARCA.azul700, lineHeight: 1, mb: 1 }} aria-hidden>⌕</Typography>
            <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Sin resultados</Typography>
            <Typography sx={{ fontSize: 13, color: '#6b7280' }}>No encontramos ventas asociadas a esa cédula. Verifica el número e intenta de nuevo.</Typography>
          </Paper>
        )}
        {lista?.map((v) => (
          <Accordion
            key={v.id} expanded={expandido === v.id} onChange={(_e, abre) => setAbierto(abre ? v.id : -1)} disableGutters
            sx={{ mb: 1.5, borderRadius: '12px !important', overflow: 'hidden', boxShadow: '0 1px 3px rgba(16,24,40,.08)', '&:before': { display: 'none' } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2.5, '& .MuiAccordionSummary-content': { my: 1.75 } }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontWeight: 500 }}>{v.nombre} {v.apellido}</Typography>
                <Box component="span" sx={{ fontSize: 12, fontWeight: 600, px: 1.25, py: 0.25, borderRadius: '6px', bgcolor: MARCA.azul700, color: '#fff' }}>CI {v.cedula}</Box>
                <PildoraServicio>{v.servicio.trim()}</PildoraServicio>
                <Typography sx={{ fontSize: 13, color: '#6b7280' }}>{v.producto} · {fechaLarga(v.fecha_venta)}</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 2.5, pb: 2.5 }}>
              <FormVenta
                key={`${v.id}-${ventas.dataUpdatedAt}`} venta={v} onVolver={limpiar}
                onListo={(m) => { setMensaje(m); void ventas.refetch(); }}
              />
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </Pagina>
  );
}
