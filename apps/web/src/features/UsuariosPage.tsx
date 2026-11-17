/**
 * Usuarios: alta, edición, reinicio de contraseña e inactivación.
 */
import { useState, type FormEvent } from 'react';
import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import BlockIcon from '@mui/icons-material/BlockOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import KeyIcon from '@mui/icons-material/KeyOutlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PASSWORD_MIN, REGISTRO, ROLES, ROL_NOMBRE } from '@bulkapp/shared';
import { api, mensajeDe } from '../shared/api.ts';
import { useUsuario } from '../shared/auth.tsx';
import { Tabla, opcionesCampana, useCampanas } from '../shared/datos.tsx';
import { ChipEstado, Confirmacion, Consulta, Pagina, Seccion, Selector, useAvisos } from '../shared/ui.tsx';

interface Usuario {
  id: number; nombre: string; apellido: string; username: string; usertype_id: number; rol: string; status_id: number; status: string;
  servicio_id: number; campana: string; campanas_extra: number;
}
interface Borrador { id: number | null; nombre: string; apellido: string; username: string; password: string; usertype_id: string; status_id: string; servicio_id: string }

const NUEVO: Borrador = { id: null, nombre: '', apellido: '', username: '', password: '', usertype_id: '', status_id: String(REGISTRO.ACTIVO), servicio_id: '' };

function Editor({ inicial, onCerrar }: { inicial: Borrador; onCerrar: () => void }) {
  const avisos = useAvisos();
  const cache = useQueryClient();
  const campanas = useCampanas({ activas: true });
  const [b, setB] = useState(inicial);
  const esNuevo = b.id === null;

  const guardar = useMutation({
    mutationFn: () => (esNuevo ? api.post('/admin/usuarios', b) : api.put(`/admin/usuarios/${b.id}`, b)),
    onSuccess: () => {
      avisos.ok(esNuevo ? 'Usuario creado.' : 'Usuario actualizado.');
      void cache.invalidateQueries({ queryKey: ['usuarios'] });
      onCerrar();
    },
  });
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    guardar.mutate();
  };
  const campo = (k: 'nombre' | 'apellido' | 'username' | 'password', label: string, extra: object = {}) => (
    <TextField label={label} value={b[k]} onChange={(e) => setB({ ...b, [k]: e.target.value })} required fullWidth {...extra} />
  );

  return (
    <Dialog open onClose={guardar.isPending ? undefined : onCerrar} maxWidth="sm" fullWidth>
      <form onSubmit={enviar}>
        <DialogTitle>{esNuevo ? 'Nuevo usuario' : `Editar usuario · ${b.username}`}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {guardar.isError && <Alert severity="error">{mensajeDe(guardar.error)}</Alert>}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              {campo('nombre', 'Nombre', { slotProps: { htmlInput: { maxLength: 50 } } })}
              {campo('apellido', 'Apellido', { slotProps: { htmlInput: { maxLength: 50 } } })}
            </Stack>
            {esNuevo && (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                {campo('username', 'Usuario', { autoComplete: 'off', helperText: 'Letras, números, punto, guion y guion bajo.', slotProps: { htmlInput: { maxLength: 50, pattern: '[A-Za-z0-9._\\-]+' } } })}
                {campo('password', 'Contraseña', { type: 'password', autoComplete: 'new-password', helperText: `Mínimo ${PASSWORD_MIN} caracteres.`, slotProps: { htmlInput: { minLength: PASSWORD_MIN } } })}
              </Stack>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Selector
                label="Rol" required value={b.usertype_id} vacio="Selecciona…" onChange={(e) => setB({ ...b, usertype_id: e.target.value })}
                opciones={ROLES.map((r) => ({ value: String(r), label: ROL_NOMBRE[r] ?? String(r) }))}
              />
              {!esNuevo && (
                <Selector
                  label="Estado" required value={b.status_id} onChange={(e) => setB({ ...b, status_id: e.target.value })}
                  opciones={[{ value: String(REGISTRO.ACTIVO), label: 'Activo' }, { value: String(REGISTRO.INACTIVO), label: 'Inactivo' }]}
                />
              )}
            </Stack>
            <Selector
              label="Campaña principal" required value={b.servicio_id} vacio="Selecciona…" opciones={opcionesCampana(campanas.data)}
              onChange={(e) => setB({ ...b, servicio_id: e.target.value })}
              helperText="Las campañas adicionales se asignan desde «Empresas y campañas»."
            />
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

export default function UsuariosPage() {
  const avisos = useAvisos();
  const cache = useQueryClient();
  const yo = useUsuario();
  const usuarios = useQuery({ queryKey: ['usuarios'], queryFn: () => api.get<Usuario[]>('/admin/usuarios') });
  const [editor, setEditor] = useState<Borrador | null>(null);
  const [aInactivar, setAInactivar] = useState<Usuario | null>(null);
  const [aReiniciar, setAReiniciar] = useState<Usuario | null>(null);
  const [temporal, setTemporal] = useState<{ username: string; password: string } | null>(null);

  const inactivar = useMutation({
    mutationFn: (u: Usuario) => api.delete(`/admin/usuarios/${u.id}`),
    onSuccess: () => {
      avisos.ok('Usuario inactivado.');
      setAInactivar(null);
      void cache.invalidateQueries({ queryKey: ['usuarios'] });
    },
    onError: (e) => avisos.error(e),
  });
  const reiniciar = useMutation({
    mutationFn: (u: Usuario) => api.post<{ password: string }>(`/admin/usuarios/${u.id}/password`),
    onSuccess: (r, u) => {
      setAReiniciar(null);
      setTemporal({ username: u.username, password: r.password });
    },
    onError: (e) => avisos.error(e),
  });

  return (
    <Pagina titulo="Usuarios" subtitulo="Operadores, supervisores y administradores." acciones={<Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditor(NUEVO)}>Nuevo usuario</Button>}>
      <Seccion>
        <Consulta query={usuarios}>
          {(lista) => (
            <Tabla
              filas={lista} clave={(u) => u.id} vacio="No hay usuarios."
              columnas={[
                { titulo: 'Nombre', celda: (u) => `${u.nombre} ${u.apellido}` },
                { titulo: 'Usuario', celda: (u) => u.username },
                { titulo: 'Rol', celda: (u) => ROL_NOMBRE[u.usertype_id] ?? u.rol },
                { titulo: 'Campaña principal', celda: (u) => (
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <span>{u.campana}</span>
                    {u.campanas_extra > 0 && <Chip size="small" variant="outlined" label={`+${u.campanas_extra}`} />}
                  </Stack>
                ) },
                { titulo: 'Estado', celda: (u) => <ChipEstado statusId={u.status_id} /> },
                { titulo: 'Acciones', ancho: 140, celda: (u) => (
                  <Stack direction="row">
                    <Tooltip title="Editar"><IconButton size="small" aria-label={`Editar a ${u.username}`} onClick={() => setEditor({ id: u.id, nombre: u.nombre, apellido: u.apellido, username: u.username, password: '', usertype_id: String(u.usertype_id), status_id: String(u.status_id), servicio_id: String(u.servicio_id) })}><EditIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Reiniciar contraseña"><IconButton size="small" aria-label={`Reiniciar contraseña de ${u.username}`} onClick={() => setAReiniciar(u)}><KeyIcon fontSize="small" /></IconButton></Tooltip>
                    {u.status_id === REGISTRO.ACTIVO && u.id !== yo.id && (
                      <Tooltip title="Inactivar"><IconButton size="small" color="error" aria-label={`Inactivar a ${u.username}`} onClick={() => setAInactivar(u)}><BlockIcon fontSize="small" /></IconButton></Tooltip>
                    )}
                  </Stack>
                ) },
              ]}
            />
          )}
        </Consulta>
      </Seccion>

      {editor && <Editor key={editor.id ?? 'nuevo'} inicial={editor} onCerrar={() => setEditor(null)} />}
      <Confirmacion
        abierto={aInactivar !== null} titulo="Inactivar usuario" peligro confirmar="Inactivar" ocupado={inactivar.isPending}
        texto={<>El usuario <strong>{aInactivar?.username}</strong> no podrá iniciar sesión. Su historial de gestión se conserva.</>}
        onCerrar={() => setAInactivar(null)} onConfirmar={() => aInactivar && inactivar.mutate(aInactivar)}
      />
      <Confirmacion
        abierto={aReiniciar !== null} titulo="Reiniciar contraseña" confirmar="Generar contraseña" ocupado={reiniciar.isPending}
        texto={<>Se generará una contraseña temporal para <strong>{aReiniciar?.username}</strong> y se cerrarán sus sesiones.</>}
        onCerrar={() => setAReiniciar(null)} onConfirmar={() => aReiniciar && reiniciar.mutate(aReiniciar)}
      />
      <Dialog open={temporal !== null} maxWidth="xs" fullWidth>
        <DialogTitle>Contraseña temporal</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>Entrégala a <strong>{temporal?.username}</strong>. No se volverá a mostrar.</Typography>
          <Typography sx={{ fontFamily: 'monospace', fontSize: 20, p: 1.5, bgcolor: 'grey.100', borderRadius: 1, textAlign: 'center', userSelect: 'all' }}>{temporal?.password}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { void navigator.clipboard?.writeText(temporal?.password ?? ''); avisos.info('Copiada al portapapeles.'); }}>Copiar</Button>
          <Button variant="contained" onClick={() => setTemporal(null)}>Listo</Button>
        </DialogActions>
      </Dialog>
    </Pagina>
  );
}
