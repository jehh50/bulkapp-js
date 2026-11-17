/**
 * Clientes y ventas: carga masiva de clientes (CSV), desbloqueo de un cliente y
 * corrección o eliminación de una venta.
 */
import { useRef, useState, type FormEvent } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, IconButton, Stack, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import DownloadIcon from '@mui/icons-material/DownloadOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import LockOpenIcon from '@mui/icons-material/LockOpenOutlined';
import SearchIcon from '@mui/icons-material/Search';
import UploadIcon from '@mui/icons-material/UploadFileOutlined';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CARGA_COLUMNAS_CLIENTES, CARGA_MAX_BYTES_CLIENTES, FLUJO, GENEROS, mascaraTelefonoBanca } from '@bulkapp/shared';
import { ApiError, api, mensajeDe } from '../shared/api.ts';
import { Tabla, opcionesCampana, useCampanas } from '../shared/datos.tsx';
import { CampoFecha, Confirmacion, Pagina, Seccion, Selector, fechaLarga, numero, useAvisos } from '../shared/ui.tsx';

// --- Carga masiva ------------------------------------------------------------------

function Carga() {
  const avisos = useAvisos();
  const campanas = useCampanas({ flujo: FLUJO.BANCARIO, activas: true });
  const entrada = useRef<HTMLInputElement>(null);
  const [servicioId, setServicioId] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);

  const subir = useMutation({
    mutationFn: () => {
      const datos = new FormData();
      datos.set('servicio_id', servicioId);
      if (archivo) datos.set('archivo', archivo);
      return api.post<{ insertadas: number; omitidas: number }>('/admin/cargas-clientes', datos);
    },
    onSuccess: () => {
      setArchivo(null);
      if (entrada.current) entrada.current.value = '';
    },
  });
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (archivo && archivo.size > CARGA_MAX_BYTES_CLIENTES) avisos.error('El archivo supera el tamaño máximo (10 MB).');
    else subir.mutate();
  };

  return (
    <Seccion titulo="Carga masiva de clientes" acciones={<Button startIcon={<DownloadIcon />} onClick={() => { api.descargar('/admin/cargas-clientes/modelo').catch((e: unknown) => avisos.error(e)); }}>Descargar modelo</Button>}>
      <Stack component="form" onSubmit={enviar} spacing={2} sx={{ maxWidth: 640 }}>
        <Typography variant="body2" color="text.secondary">
          Archivo CSV separado por punto y coma (;), con encabezados en la primera fila y las columnas en este orden: {CARGA_COLUMNAS_CLIENTES.join(', ')}.
        </Typography>
        <Selector label="Campaña bancaria" required value={servicioId} vacio="Selecciona…" opciones={opcionesCampana(campanas.data)} onChange={(e) => setServicioId(e.target.value)} />
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Button component="label" variant="outlined" startIcon={<UploadIcon />}>
            Elegir archivo
            <input ref={entrada} type="file" hidden accept=".csv,.txt,text/csv,text/plain" onChange={(e) => { setArchivo(e.target.files?.[0] ?? null); subir.reset(); }} />
          </Button>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{archivo ? `${archivo.name} (${numero(Math.ceil(archivo.size / 1024))} KB)` : 'Ningún archivo seleccionado.'}</Typography>
        </Stack>
        {subir.isSuccess && (
          <Alert severity="success">
            Se cargaron {numero(subir.data.insertadas)} clientes.{subir.data.omitidas > 0 ? ` Se omitieron ${numero(subir.data.omitidas)} filas con columnas incompletas.` : ''}
          </Alert>
        )}
        {subir.isError && <Alert severity="error">{mensajeDe(subir.error)}</Alert>}
        <Button type="submit" variant="contained" disabled={!archivo || servicioId === ''} loading={subir.isPending} sx={{ alignSelf: 'flex-start' }}>Cargar clientes</Button>
      </Stack>
    </Seccion>
  );
}

// --- Desbloqueo ----------------------------------------------------------------------

interface ClienteFila { id: number; nombre_legal: string | null; telf_hab: string | null; telf_ofi: string | null; telf_cel: string | null; identificacion: string | null; status: string | null; servicio: string }

function Desbloqueo() {
  const avisos = useAvisos();
  const [q, setQ] = useState('');
  const [buscado, setBuscado] = useState('');
  const [aLiberar, setALiberar] = useState<ClienteFila | null>(null);
  const clientes = useQuery({ queryKey: ['admin', 'clientes', buscado], enabled: buscado !== '', queryFn: () => api.get<ClienteFila[]>('/admin/clientes', { q: buscado }) });

  const liberar = useMutation({
    mutationFn: (c: ClienteFila) => api.post<{ liberados: number }>('/admin/clientes/liberar', { identificacion: c.identificacion }),
    onSuccess: () => {
      avisos.ok('Cliente liberado: puede gestionarse de nuevo.');
      setALiberar(null);
      void clientes.refetch();
    },
    onError: (e) => avisos.error(e),
  });

  return (
    <Seccion titulo="Desbloqueo de cliente">
      <Stack component="form" direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }} onSubmit={(e) => { e.preventDefault(); setBuscado(q.trim()); }}>
        <TextField label="Cédula o teléfono de oficina" value={q} onChange={(e) => setQ(e.target.value)} sx={{ flex: 1, maxWidth: 420 }} slotProps={{ htmlInput: { maxLength: 30 } }} />
        <Button type="submit" variant="contained" startIcon={<SearchIcon />} loading={clientes.isFetching}>Buscar</Button>
      </Stack>
      {clientes.isError && <Alert severity="error">{mensajeDe(clientes.error)}</Alert>}
      {clientes.data && (
        <Tabla
          filas={clientes.data} clave={(c) => c.id} vacio="No se encontró ningún cliente con ese dato."
          columnas={[
            { titulo: 'Nombre', celda: (c) => c.nombre_legal ?? '' },
            { titulo: 'Cédula', celda: (c) => c.identificacion ?? '' },
            { titulo: 'Teléfonos', celda: (c) => [c.telf_hab, c.telf_ofi, c.telf_cel].filter(Boolean).join(' · ') || 'No posee' },
            { titulo: 'Campaña', celda: (c) => c.servicio.trim() },
            { titulo: 'Estado', celda: (c) => (c.status ?? 'Sin contactar').toUpperCase() },
            { titulo: '', ancho: 60, celda: (c) => <Tooltip title="Liberar"><IconButton size="small" color="primary" aria-label="Liberar cliente" onClick={() => setALiberar(c)}><LockOpenIcon fontSize="small" /></IconButton></Tooltip> },
          ]}
        />
      )}
      <Confirmacion
        abierto={aLiberar !== null} titulo="Liberar cliente" confirmar="Liberar" ocupado={liberar.isPending}
        texto={<>El cliente con cédula <strong>{aLiberar?.identificacion}</strong> volverá a «sin contactar» en todas sus campañas.</>}
        onCerrar={() => setALiberar(null)} onConfirmar={() => aLiberar && liberar.mutate(aLiberar)}
      />
    </Seccion>
  );
}

// --- Corrección de ventas ---------------------------------------------------------------

interface VentaFila {
  id: number; nombre: string; apellido: string; genero: string; fecha_nacimiento: string | null; cedula: string; telf_hab: string; telf_celular: string;
  correo: string; cuenta: string; servicio: string; servicio_id: number; producto_id: number; producto: string; fecha_venta: string;
}

function EditorVenta({ venta, onCerrar, onGuardada }: { venta: VentaFila; onCerrar: () => void; onGuardada: () => void }) {
  const avisos = useAvisos();
  const [v, setV] = useState({ ...venta, fecha_nacimiento: venta.fecha_nacimiento ?? '', producto_id: String(venta.producto_id) });
  const productos = useQuery({
    queryKey: ['reportes', 'productos', venta.servicio_id],
    queryFn: () => api.get<Array<{ id: number; descripcion: string }>>('/reportes/productos', { servicio_id: venta.servicio_id }),
  });
  const guardar = useMutation({
    mutationFn: () => api.put(`/admin/ventas/${venta.id}`, v),
    onSuccess: () => {
      avisos.ok('Venta actualizada.');
      onGuardada();
    },
  });
  const errores = guardar.error instanceof ApiError ? guardar.error.porCampo : {};
  const texto = (k: 'nombre' | 'apellido' | 'cedula' | 'telf_hab' | 'telf_celular' | 'correo' | 'cuenta', label: string, telefono = false) => (
    <TextField label={label} value={v[k]} required fullWidth error={k in errores} helperText={errores[k]} onChange={(e) => setV({ ...v, [k]: telefono ? mascaraTelefonoBanca(e.target.value) : e.target.value })} />
  );
  // El producto de la venta puede estar ya inactivo: se conserva como opción.
  const opciones = [
    ...(productos.data?.some((p) => p.id === venta.producto_id) === false ? [{ value: String(venta.producto_id), label: `${venta.producto} (inactivo)` }] : []),
    ...(productos.data ?? []).map((p) => ({ value: String(p.id), label: p.descripcion })),
  ];

  return (
    <Dialog open onClose={guardar.isPending ? undefined : onCerrar} maxWidth="md" fullWidth>
      <form onSubmit={(e) => { e.preventDefault(); guardar.mutate(); }} noValidate>
        <DialogTitle>Editar venta · {venta.servicio.trim()}</DialogTitle>
        <DialogContent dividers>
          {guardar.isError && <Alert severity="error" sx={{ mb: 2 }}>{mensajeDe(guardar.error)}</Alert>}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>{texto('nombre', 'Nombre')}</Grid>
            <Grid size={{ xs: 12, sm: 6 }}>{texto('apellido', 'Apellido')}</Grid>
            <Grid size={{ xs: 12, sm: 4 }}>{texto('cedula', 'Cédula')}</Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Selector label="Género" required value={v.genero} opciones={GENEROS.map((g) => ({ value: g, label: g === 'M' ? 'Masculino' : 'Femenino' }))} onChange={(e) => setV({ ...v, genero: e.target.value })} error={'genero' in errores} helperText={errores.genero} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}><CampoFecha label="Fecha de nacimiento" required value={v.fecha_nacimiento} onChange={(e) => setV({ ...v, fecha_nacimiento: e.target.value })} error={'fecha_nacimiento' in errores} helperText={errores.fecha_nacimiento} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}>{texto('telf_hab', 'Teléfono habitación', true)}</Grid>
            <Grid size={{ xs: 12, sm: 4 }}>{texto('telf_celular', 'Teléfono celular', true)}</Grid>
            <Grid size={{ xs: 12, sm: 4 }}>{texto('correo', 'Correo')}</Grid>
            <Grid size={{ xs: 12, sm: 4 }}><CampoFecha label="Fecha de venta" required value={v.fecha_venta} onChange={(e) => setV({ ...v, fecha_venta: e.target.value })} error={'fecha_venta' in errores} helperText={errores.fecha_venta} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><Selector label="Producto" required value={opciones.length > 0 ? v.producto_id : ''} opciones={opciones} onChange={(e) => setV({ ...v, producto_id: e.target.value })} error={'producto_id' in errores} helperText={errores.producto_id} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}>{texto('cuenta', 'Número de cuenta')}</Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCerrar} disabled={guardar.isPending}>Cancelar</Button>
          <Button type="submit" variant="contained" loading={guardar.isPending}>Guardar</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function Ventas() {
  const avisos = useAvisos();
  const [cedula, setCedula] = useState('');
  const [buscada, setBuscada] = useState('');
  const [editando, setEditando] = useState<VentaFila | null>(null);
  const [aEliminar, setAEliminar] = useState<VentaFila | null>(null);
  const ventas = useQuery({ queryKey: ['admin', 'ventas', buscada], enabled: buscada !== '', queryFn: () => api.get<VentaFila[]>('/admin/ventas', { cedula: buscada }) });

  const eliminar = useMutation({
    mutationFn: (v: VentaFila) => api.delete(`/admin/ventas/${v.id}`),
    onSuccess: () => {
      avisos.ok('Venta eliminada.');
      setAEliminar(null);
      void ventas.refetch();
    },
    onError: (e) => avisos.error(e),
  });

  return (
    <Seccion titulo="Corregir una venta">
      <Stack component="form" direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }} onSubmit={(e) => { e.preventDefault(); setBuscada(cedula.trim()); }}>
        <TextField label="Cédula del titular" value={cedula} onChange={(e) => setCedula(e.target.value.replace(/\D+/g, '').slice(0, 10))} sx={{ flex: 1, maxWidth: 420 }} slotProps={{ htmlInput: { inputMode: 'numeric' } }} />
        <Button type="submit" variant="contained" startIcon={<SearchIcon />} loading={ventas.isFetching}>Buscar</Button>
      </Stack>
      {ventas.isError && <Alert severity="error">{mensajeDe(ventas.error)}</Alert>}
      {ventas.data && (
        <Tabla
          filas={ventas.data} clave={(v) => v.id} vacio="No hay ventas registradas con esa cédula."
          columnas={[
            { titulo: 'Titular', celda: (v) => `${v.nombre} ${v.apellido}` },
            { titulo: 'Cédula', celda: (v) => v.cedula },
            { titulo: 'Campaña', celda: (v) => v.servicio.trim() },
            { titulo: 'Producto', celda: (v) => v.producto },
            { titulo: 'Fecha de venta', celda: (v) => fechaLarga(v.fecha_venta) },
            { titulo: '', ancho: 100, celda: (v) => (
              <Stack direction="row">
                <Tooltip title="Editar"><IconButton size="small" aria-label="Editar venta" onClick={() => setEditando(v)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Eliminar"><IconButton size="small" color="error" aria-label="Eliminar venta" onClick={() => setAEliminar(v)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
              </Stack>
            ) },
          ]}
        />
      )}
      {editando && <EditorVenta key={editando.id} venta={editando} onCerrar={() => setEditando(null)} onGuardada={() => { setEditando(null); void ventas.refetch(); }} />}
      <Confirmacion
        abierto={aEliminar !== null} titulo="Eliminar venta" peligro confirmar="Eliminar" ocupado={eliminar.isPending}
        texto={<>Se eliminará la venta de <strong>{aEliminar?.nombre} {aEliminar?.apellido}</strong> del {fechaLarga(aEliminar?.fecha_venta ?? '')}. Esta acción no se puede deshacer.</>}
        onCerrar={() => setAEliminar(null)} onConfirmar={() => aEliminar && eliminar.mutate(aEliminar)}
      />
    </Seccion>
  );
}

type Pestana = 'carga' | 'desbloqueo' | 'ventas';

export default function ClientesPage() {
  const [pestana, setPestana] = useState<Pestana>('carga');
  return (
    <Pagina titulo="Clientes y ventas" subtitulo="Carga de bases de clientes, desbloqueo y corrección de ventas (campañas bancarias).">
      <Tabs value={pestana} onChange={(_e, v: Pestana) => setPestana(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="carga" label="Carga de BBDD" />
        <Tab value="desbloqueo" label="Desbloqueo" />
        <Tab value="ventas" label="Editar venta" />
      </Tabs>
      {pestana === 'carga' && <Carga />}
      {pestana === 'desbloqueo' && <Desbloqueo />}
      {pestana === 'ventas' && <Ventas />}
    </Pagina>
  );
}
