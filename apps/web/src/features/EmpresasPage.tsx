/**
 * Clientes (empresas), sus campañas y los usuarios asignados a cada campaña.
 */
import { useState, type FormEvent } from 'react';
import {
  Alert, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, IconButton, List, ListItemButton, ListItemIcon,
  ListItemText, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/EditOutlined';
import GroupIcon from '@mui/icons-material/GroupOutlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FLUJO, REGISTRO, ROL_NOMBRE, validarCampana, validarEmpresa, type Flujo } from '@bulkapp/shared';
import { api, mensajeDe } from '../shared/api.ts';
import { Tabla } from '../shared/datos.tsx';
import { CampoFecha, ChipEstado, Consulta, Pagina, Seccion, Selector, fechaLarga, hoy, numero, useAvisos } from '../shared/ui.tsx';

interface Empresa { id: number; nombre: string; identificacion: string | null; status_id: number; campanas?: number; campanas_activas?: number; usuarios?: number }
interface Campana {
  id: number; nombre: string; detalle: string | null; fecha_inicio: string; meta: number | null; tipo_flujo: Flujo; codigo: string; status_id: number;
  usuarios: number; productos: number;
}
interface UsuarioCampana { id: number; username: string; nombre: string; apellido: string; usertype_id: number; asignado: boolean; principal: boolean }

const ESTADOS = [{ value: String(REGISTRO.ACTIVO), label: 'Activo' }, { value: String(REGISTRO.INACTIVO), label: 'Inactivo' }];
const FLUJO_NOMBRE: Record<Flujo, string> = { [FLUJO.BANCARIO]: 'Bancario', [FLUJO.DINAMICO]: 'Formulario dinámico' };

function EditorEmpresa({ empresa, onCerrar }: { empresa: Empresa | null; onCerrar: () => void }) {
  const avisos = useAvisos();
  const cache = useQueryClient();
  const [b, setB] = useState({ nombre: empresa?.nombre ?? '', identificacion: empresa?.identificacion ?? '', status_id: String(empresa?.status_id ?? REGISTRO.ACTIVO) });
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () => (empresa ? api.put<{ campanas_inactivadas: number }>(`/organizacion/empresas/${empresa.id}`, b) : api.post<{ campanas_inactivadas: number }>('/organizacion/empresas', b)),
    onSuccess: (r) => {
      avisos.ok(r.campanas_inactivadas > 0 ? `Cliente guardado. Se inactivaron ${r.campanas_inactivadas} campañas.` : 'Cliente guardado.');
      void cache.invalidateQueries({ queryKey: ['empresas'] });
      onCerrar();
    },
    onError: (e) => setError(mensajeDe(e)),
  });
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const v = validarEmpresa(b);
    if (v.ok) guardar.mutate();
    else setError(v.errores.join(' '));
  };

  return (
    <Dialog open onClose={guardar.isPending ? undefined : onCerrar} maxWidth="xs" fullWidth>
      <form onSubmit={enviar} noValidate>
        <DialogTitle>{empresa ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Nombre" required value={b.nombre} onChange={(e) => setB({ ...b, nombre: e.target.value })} slotProps={{ htmlInput: { maxLength: 100 } }} autoFocus />
            <TextField label="RIF" value={b.identificacion} onChange={(e) => setB({ ...b, identificacion: e.target.value.toUpperCase() })} placeholder="J-12345678-9" helperText="Opcional." slotProps={{ htmlInput: { maxLength: 30 } }} />
            {empresa && (
              <Selector label="Estado" value={b.status_id} opciones={ESTADOS} onChange={(e) => setB({ ...b, status_id: e.target.value })} helperText={b.status_id === String(REGISTRO.INACTIVO) ? 'Al inactivar el cliente se inactivan todas sus campañas.' : undefined} />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCerrar} disabled={guardar.isPending}>Cancelar</Button>
          <Button type="submit" variant="contained" loading={guardar.isPending}>Guardar</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function EditorCampana({ empresaId, campana, onCerrar }: { empresaId: number; campana: Campana | null; onCerrar: () => void }) {
  const avisos = useAvisos();
  const cache = useQueryClient();
  const esNueva = campana === null;
  const [b, setB] = useState({
    nombre: campana?.nombre ?? '', detalle: campana?.detalle ?? '', fecha_inicio: campana?.fecha_inicio ?? hoy(), meta: campana?.meta != null ? String(campana.meta) : '',
    tipo_flujo: campana?.tipo_flujo ?? '', codigo: campana?.codigo ?? '', status_id: String(campana?.status_id ?? REGISTRO.ACTIVO),
  });
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () => (campana ? api.put(`/organizacion/empresas/${empresaId}/campanas/${campana.id}`, b) : api.post(`/organizacion/empresas/${empresaId}/campanas`, b)),
    onSuccess: () => {
      avisos.ok('Campaña guardada.');
      void cache.invalidateQueries({ queryKey: ['empresas'] });
      void cache.invalidateQueries({ queryKey: ['campanas'] });
      onCerrar();
    },
    onError: (e) => setError(mensajeDe(e)),
  });
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const v = validarCampana(b, esNueva);
    if (v.ok) guardar.mutate();
    else setError(v.errores.join(' '));
  };

  return (
    <Dialog open onClose={guardar.isPending ? undefined : onCerrar} maxWidth="sm" fullWidth>
      <form onSubmit={enviar} noValidate>
        <DialogTitle>{esNueva ? 'Nueva campaña' : 'Editar campaña'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            {error && <Grid size={12}><Alert severity="error">{error}</Alert></Grid>}
            <Grid size={{ xs: 12, sm: 8 }}><TextField label="Nombre" required fullWidth value={b.nombre} onChange={(e) => setB({ ...b, nombre: e.target.value })} slotProps={{ htmlInput: { maxLength: 50 } }} autoFocus /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><CampoFecha label="Fecha de inicio" required value={b.fecha_inicio} onChange={(e) => setB({ ...b, fecha_inicio: e.target.value })} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Selector
                label="Tipo de flujo" required value={b.tipo_flujo} vacio={esNueva ? 'Selecciona…' : undefined} disabled={!esNueva}
                opciones={[FLUJO.BANCARIO, FLUJO.DINAMICO].map((f) => ({ value: f, label: FLUJO_NOMBRE[f] }))}
                onChange={(e) => setB({ ...b, tipo_flujo: e.target.value })} helperText={esNueva ? 'No se puede cambiar después de crear la campaña.' : 'Se fijó al crear la campaña.'}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField label="Código" fullWidth value={b.codigo} required={esNueva && b.tipo_flujo === FLUJO.BANCARIO} onChange={(e) => setB({ ...b, codigo: e.target.value.toUpperCase() })} helperText="Company code del XML." slotProps={{ htmlInput: { maxLength: 10 } }} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField label="Meta" fullWidth type="number" value={b.meta} onChange={(e) => setB({ ...b, meta: e.target.value })} slotProps={{ htmlInput: { min: 1 } }} /></Grid>
            <Grid size={12}><TextField label="Descripción" fullWidth multiline minRows={2} value={b.detalle} onChange={(e) => setB({ ...b, detalle: e.target.value })} slotProps={{ htmlInput: { maxLength: 500 } }} /></Grid>
            {!esNueva && <Grid size={{ xs: 12, sm: 6 }}><Selector label="Estado" value={b.status_id} opciones={ESTADOS} onChange={(e) => setB({ ...b, status_id: e.target.value })} /></Grid>}
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

function Asignados({ usuarios, campanaId, onCerrar }: { usuarios: UsuarioCampana[]; campanaId: number; onCerrar: () => void }) {
  const avisos = useAvisos();
  const cache = useQueryClient();
  const [marcados, setMarcados] = useState(() => new Set(usuarios.filter((u) => u.asignado).map((u) => u.id)));
  const [filtro, setFiltro] = useState('');

  const guardar = useMutation({
    mutationFn: () => api.put<{ agregados: number; quitados: number; principal_movida: number; bloqueados: Array<{ username: string }> }>(`/organizacion/campanas/${campanaId}/usuarios`, { usuarios: [...marcados] }),
    onSuccess: (r) => {
      if (r.bloqueados.length > 0) avisos.error(`No se pudo quitar a ${r.bloqueados.map((b) => b.username).join(', ')}: es su única campaña.`);
      else avisos.ok(`Asignación guardada: ${r.agregados} agregados, ${r.quitados} quitados.`);
      void cache.invalidateQueries({ queryKey: ['empresas'] });
      void cache.invalidateQueries({ queryKey: ['usuarios'] });
      onCerrar();
    },
    onError: (e) => avisos.error(e),
  });
  const alternar = (id: number) => {
    const siguiente = new Set(marcados);
    if (!siguiente.delete(id)) siguiente.add(id);
    setMarcados(siguiente);
  };
  const termino = filtro.trim().toLowerCase();
  const visibles = usuarios.filter((u) => termino === '' || `${u.nombre} ${u.apellido} ${u.username}`.toLowerCase().includes(termino));

  return (
    <>
      <DialogContent dividers>
        <TextField label="Filtrar usuarios" value={filtro} onChange={(e) => setFiltro(e.target.value)} fullWidth sx={{ mb: 1 }} />
        <List dense sx={{ maxHeight: 380, overflowY: 'auto' }}>
          {visibles.map((u) => (
            <ListItemButton key={u.id} onClick={() => alternar(u.id)} dense>
              <ListItemIcon sx={{ minWidth: 36 }}><Checkbox edge="start" checked={marcados.has(u.id)} tabIndex={-1} disableRipple size="small" /></ListItemIcon>
              <ListItemText primary={`${u.nombre} ${u.apellido}`} secondary={`${u.username} · ${ROL_NOMBRE[u.usertype_id] ?? ''}`} />
              {u.principal && <Chip size="small" label="Principal" variant="outlined" />}
            </ListItemButton>
          ))}
        </List>
        <Typography variant="caption" color="text.secondary">{marcados.size} usuarios asignados. Al quitar a alguien de su campaña principal se le asigna otra de las suyas.</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar} disabled={guardar.isPending}>Cancelar</Button>
        <Button variant="contained" loading={guardar.isPending} onClick={() => guardar.mutate()}>Guardar asignación</Button>
      </DialogActions>
    </>
  );
}

function DialogoUsuarios({ campana, onCerrar }: { campana: Campana; onCerrar: () => void }) {
  const consulta = useQuery({
    queryKey: ['empresas', 'usuarios', campana.id], gcTime: 0, staleTime: 0,
    queryFn: () => api.get<{ usuarios: UsuarioCampana[] }>(`/organizacion/campanas/${campana.id}/usuarios`),
  });
  return (
    <Dialog open onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle>Usuarios de «{campana.nombre}»</DialogTitle>
      {consulta.data
        ? <Asignados usuarios={consulta.data.usuarios} campanaId={campana.id} onCerrar={onCerrar} />
        : <DialogContent><Consulta query={consulta}>{() => null}</Consulta></DialogContent>}
    </Dialog>
  );
}

function Detalle({ empresaId, onVolver }: { empresaId: number; onVolver: () => void }) {
  const consulta = useQuery({ queryKey: ['empresas', empresaId], queryFn: () => api.get<{ empresa: Empresa; campanas: Campana[] }>(`/organizacion/empresas/${empresaId}`) });
  const [editarEmpresa, setEditarEmpresa] = useState(false);
  const [campana, setCampana] = useState<Campana | 'nueva' | null>(null);
  const [usuariosDe, setUsuariosDe] = useState<Campana | null>(null);

  return (
    <Consulta query={consulta}>
      {({ empresa, campanas }) => (
        <Pagina
          titulo={empresa.nombre} subtitulo={empresa.identificacion ? `RIF ${empresa.identificacion}` : 'Sin RIF registrado'}
          acciones={(
            <>
              <Button startIcon={<ArrowBackIcon />} onClick={onVolver}>Clientes</Button>
              <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setEditarEmpresa(true)}>Editar cliente</Button>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCampana('nueva')} disabled={empresa.status_id !== REGISTRO.ACTIVO}>Nueva campaña</Button>
            </>
          )}
        >
          <Stack spacing={2}>
            {empresa.status_id !== REGISTRO.ACTIVO && <Alert severity="warning">Este cliente está inactivo: sus campañas no pueden activarse.</Alert>}
            <Seccion titulo="Campañas">
              <Tabla
                filas={campanas} clave={(c) => c.id} vacio="Este cliente aún no tiene campañas."
                columnas={[
                  { titulo: 'Campaña', celda: (c) => c.nombre },
                  { titulo: 'Flujo', celda: (c) => FLUJO_NOMBRE[c.tipo_flujo] },
                  { titulo: 'Código', celda: (c) => c.codigo },
                  { titulo: 'Inicio', celda: (c) => fechaLarga(c.fecha_inicio) },
                  { titulo: 'Meta', numerica: true, celda: (c) => (c.meta != null ? numero(c.meta) : '—') },
                  { titulo: 'Usuarios', numerica: true, celda: (c) => c.usuarios },
                  { titulo: 'Estado', celda: (c) => <ChipEstado statusId={c.status_id} /> },
                  { titulo: '', ancho: 100, celda: (c) => (
                    <Stack direction="row">
                      <Tooltip title="Editar"><IconButton size="small" aria-label={`Editar ${c.nombre}`} onClick={() => setCampana(c)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Usuarios asignados"><IconButton size="small" aria-label={`Usuarios de ${c.nombre}`} onClick={() => setUsuariosDe(c)}><GroupIcon fontSize="small" /></IconButton></Tooltip>
                    </Stack>
                  ) },
                ]}
              />
            </Seccion>
          </Stack>
          {editarEmpresa && <EditorEmpresa empresa={empresa} onCerrar={() => setEditarEmpresa(false)} />}
          {campana && <EditorCampana empresaId={empresa.id} campana={campana === 'nueva' ? null : campana} onCerrar={() => setCampana(null)} />}
          {usuariosDe && <DialogoUsuarios campana={usuariosDe} onCerrar={() => setUsuariosDe(null)} />}
        </Pagina>
      )}
    </Consulta>
  );
}

export default function EmpresasPage() {
  const empresas = useQuery({ queryKey: ['empresas'], queryFn: () => api.get<Empresa[]>('/organizacion/empresas') });
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [nueva, setNueva] = useState(false);

  if (seleccion !== null) return <Detalle empresaId={seleccion} onVolver={() => setSeleccion(null)} />;
  return (
    <Pagina titulo="Empresas y campañas" subtitulo="Clientes, sus campañas y los usuarios asignados." acciones={<Button variant="contained" startIcon={<AddIcon />} onClick={() => setNueva(true)}>Nuevo cliente</Button>}>
      <Seccion>
        <Consulta query={empresas}>
          {(lista) => (
            <Tabla
              filas={lista} clave={(e) => e.id} vacio="Aún no hay clientes."
              columnas={[
                { titulo: 'Cliente', celda: (e) => <Button size="small" onClick={() => setSeleccion(e.id)} sx={{ textAlign: 'left' }}>{e.nombre}</Button> },
                { titulo: 'RIF', celda: (e) => e.identificacion ?? '—' },
                { titulo: 'Campañas activas', numerica: true, celda: (e) => `${e.campanas_activas ?? 0} de ${e.campanas ?? 0}` },
                { titulo: 'Usuarios', numerica: true, celda: (e) => e.usuarios ?? 0 },
                { titulo: 'Estado', celda: (e) => <ChipEstado statusId={e.status_id} /> },
              ]}
            />
          )}
        </Consulta>
      </Seccion>
      {nueva && <EditorEmpresa empresa={null} onCerrar={() => setNueva(false)} />}
    </Pagina>
  );
}
