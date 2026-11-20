/**
 * Bandeja de usuarios con el diseño de `views/usuarios/index.php` + `usuarios.js`:
 * lista con buscador y paginación de 10, alta y edición en tarjeta (no en ventana),
 * «Reiniciar contraseña» dentro de la edición y avisos que se cierran con ×.
 * `/admin/usuarios/nuevo` abre directamente el alta (menú «Nuevo usuario»).
 */
import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Box, Button, MenuItem, Pagination, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/EditOutlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PASSWORD_MIN, REGISTRO, ROLES, ROL_NOMBRE } from '@bulkapp/shared';
import { api, mensajeDe } from '../shared/api.ts';
import { useUsuario } from '../shared/auth.tsx';
import { useCampanas } from '../shared/datos.tsx';
import {
  AccionesForm, Aviso, BOTON_DORADO, BotonIcono, Buscador, ErrorForm, Etiqueta, Ficha, PildoraEstado, PildoraServicio, RejillaForm, TablaConfig, TarjetaConfig, TituloTarjeta,
} from '../shared/config.tsx';
import { Confirmacion, Consulta, Pagina } from '../shared/ui.tsx';

interface Usuario {
  id: number; nombre: string; apellido: string; username: string; usertype_id: number; rol: string; status_id: number; status: string;
  servicio_id: number; campana: string; campanas_extra: number;
}
interface Borrador { id: number | null; nombre: string; apellido: string; username: string; password: string; usertype_id: string; status_id: string; servicio_id: string }
type Mensaje = { tipo: 'ok' | 'error'; texto: string };

const NUEVO: Borrador = { id: null, nombre: '', apellido: '', username: '', password: '', usertype_id: '', status_id: String(REGISTRO.ACTIVO), servicio_id: '' };
const POR_PAGINA = 10;

function Formulario({ inicial, onVolver, onMensaje }: { inicial: Borrador; onVolver: () => void; onMensaje: (m: Mensaje, volver: boolean) => void }) {
  const cache = useQueryClient();
  const campanas = useCampanas({ activas: true });
  const [b, setB] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  const [reiniciar, setReiniciar] = useState(false);
  const esNuevo = b.id === null;

  const guardar = useMutation({
    mutationFn: () => (esNuevo ? api.post('/admin/usuarios', b) : api.put(`/admin/usuarios/${b.id}`, b)),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ['usuarios'] });
      onMensaje({ tipo: 'ok', texto: esNuevo ? `Usuario ${b.username} registrado correctamente.` : 'Usuario actualizado correctamente.' }, true);
    },
    onError: (e) => setError(mensajeDe(e)),
  });
  const clave = useMutation({
    mutationFn: () => api.post<{ password: string }>(`/admin/usuarios/${b.id}/password`),
    onSuccess: (r) => {
      setReiniciar(false);
      onMensaje({ tipo: 'ok', texto: `Contraseña temporal de ${b.username}: ${r.password}. El usuario debe cambiarla al ingresar.` }, false);
    },
    onError: (e) => { setReiniciar(false); setError(mensajeDe(e)); },
  });
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const faltan = !b.nombre.trim() || !b.apellido.trim() || !b.usertype_id || !b.servicio_id || (esNuevo && (!b.username.trim() || !b.password));
    if (faltan) { setError('Complete todos los campos.'); return; }
    if (esNuevo && b.password.length < PASSWORD_MIN) { setError(`La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`); return; }
    setError(null);
    guardar.mutate();
  };
  const texto = (k: 'nombre' | 'apellido', titulo: string, placeholder: string) => (
    <Etiqueta texto={titulo} htmlFor={`u_${k}`}>
      <TextField id={`u_${k}`} value={b[k]} placeholder={placeholder} required onChange={(e) => setB({ ...b, [k]: e.target.value.toUpperCase() })} slotProps={{ htmlInput: { maxLength: 50 } }} />
    </Etiqueta>
  );
  const selector = (k: 'usertype_id' | 'status_id' | 'servicio_id', titulo: string, opciones: Array<{ v: string; l: string }>, vacio?: string) => (
    <Etiqueta texto={titulo} htmlFor={`u_${k}`}>
      <TextField id={`u_${k}`} select value={b[k]} onChange={(e) => setB({ ...b, [k]: e.target.value })} slotProps={{ select: { displayEmpty: true } }}>
        {vacio && <MenuItem value="" disabled>{vacio}</MenuItem>}
        {opciones.map((o) => <MenuItem key={o.v} value={o.v}>{o.l}</MenuItem>)}
      </TextField>
    </Etiqueta>
  );
  const roles = ROLES.map((r) => ({ v: String(r), l: esNuevo ? (ROL_NOMBRE[r] ?? String(r)) : (ROL_NOMBRE[r] ?? String(r)).toUpperCase() }));
  const servicios = (campanas.data ?? []).map((c) => ({ v: String(c.id), l: c.etiqueta }));

  return (
    <TarjetaConfig>
      <TituloTarjeta titulo={esNuevo ? 'Nuevo usuario' : `Edición de usuario · ${b.username}`} />
      <Box component="form" onSubmit={enviar} noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <RejillaForm>
          {esNuevo ? (
            <>
              {texto('nombre', 'Nombre', 'Juan')}
              {texto('apellido', 'Apellido', 'Gomez')}
              <Etiqueta texto="Usuario" htmlFor="u_username">
                <TextField id="u_username" value={b.username} placeholder="jgomez" autoComplete="off" required onChange={(e) => setB({ ...b, username: e.target.value })} slotProps={{ htmlInput: { maxLength: 50, pattern: '[A-Za-z0-9._\\-]+' } }} />
              </Etiqueta>
              <Etiqueta texto="Contraseña" htmlFor="u_password" ayuda={`Mínimo ${PASSWORD_MIN} caracteres`}>
                <TextField id="u_password" type="password" value={b.password} autoComplete="new-password" required onChange={(e) => setB({ ...b, password: e.target.value })} slotProps={{ htmlInput: { minLength: PASSWORD_MIN } }} />
              </Etiqueta>
              {selector('usertype_id', 'Tipo de usuario', roles, 'Seleccione…')}
              {selector('servicio_id', 'Campaña principal', servicios, 'Campaña…')}
            </>
          ) : (
            <>
              <Etiqueta texto="Usuario"><TextField value={b.username} slotProps={{ htmlInput: { readOnly: true } }} sx={{ '& input': { bgcolor: '#f3f4f6' } }} /></Etiqueta>
              {texto('nombre', 'Nombre', '')}
              {texto('apellido', 'Apellido', '')}
              {selector('usertype_id', 'Rol activo', roles)}
              {selector('status_id', 'Estatus', [{ v: String(REGISTRO.ACTIVO), l: 'ACTIVO' }, { v: String(REGISTRO.INACTIVO), l: 'INACTIVO' }])}
              {selector('servicio_id', 'Campaña principal', servicios)}
            </>
          )}
        </RejillaForm>
        {error && <ErrorForm>{error}</ErrorForm>}
        <AccionesForm>
          <Button variant="outlined" onClick={onVolver} disabled={guardar.isPending}>Regresar</Button>
          {!esNuevo && <Button variant="outlined" color="inherit" sx={{ borderColor: '#d1d5db', bgcolor: '#fff', fontWeight: 500 }} onClick={() => setReiniciar(true)}>Reiniciar contraseña</Button>}
          <Button type="submit" variant="contained" loading={guardar.isPending}>{esNuevo ? 'Guardar' : 'Actualizar'}</Button>
        </AccionesForm>
      </Box>
      <Confirmacion
        abierto={reiniciar} titulo="Reiniciar contraseña" confirmar="Reiniciar" ocupado={clave.isPending}
        texto={<>¿Reiniciar la contraseña de <strong>{b.username}</strong>? Se generará una contraseña temporal que el usuario debe cambiar al ingresar.</>}
        onCerrar={() => setReiniciar(false)} onConfirmar={() => clave.mutate()}
      />
    </TarjetaConfig>
  );
}

function Lista({ usuarios, onNuevo, onEditar, onEliminar }: { usuarios: Usuario[]; onNuevo: () => void; onEditar: (u: Usuario) => void; onEliminar: (u: Usuario) => void }) {
  const yo = useUsuario();
  const [q, setQ] = useState('');
  const [pagina, setPagina] = useState(1);
  const termino = q.trim().toLowerCase();
  const filtrados = usuarios.filter((u) => termino === '' || [u.id, u.username, u.nombre, u.apellido, ROL_NOMBRE[u.usertype_id] ?? u.rol, u.campana, u.status].join(' ').toLowerCase().includes(termino));
  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const actual = Math.min(pagina, paginas);
  const desde = (actual - 1) * POR_PAGINA;
  const visibles = filtrados.slice(desde, desde + POR_PAGINA);

  return (
    <TarjetaConfig>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Buscador valor={q} onCambio={(v) => { setQ(v); setPagina(1); }} placeholder="Buscar usuario, nombre, rol, campaña…" />
        <Button variant="contained" onClick={onNuevo} sx={{ height: 44, px: 2.25, ...BOTON_DORADO }}>+ Agregar usuario</Button>
      </Box>
      <TablaConfig>
        <TableHead>
          <TableRow>
            {['ID', 'Usuario', 'Nombre', 'Apellido', 'Rol', 'Campaña principal', 'Estatus'].map((t) => <TableCell key={t}>{t}</TableCell>)}
            <TableCell align="center">Editar</TableCell><TableCell align="center">Eliminar</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {visibles.map((u) => (
            <TableRow key={u.id} hover>
              <TableCell sx={{ fontWeight: 500 }}>{u.id}</TableCell>
              <TableCell>{u.username}</TableCell>
              <TableCell>{u.nombre}</TableCell>
              <TableCell>{u.apellido}</TableCell>
              <TableCell>{(ROL_NOMBRE[u.usertype_id] ?? u.rol).toUpperCase()}</TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <PildoraServicio>{u.campana.trim()}</PildoraServicio>
                  {u.campanas_extra > 0 && <span title="Otras campañas asignadas"><Ficha>+{u.campanas_extra}</Ficha></span>}
                </Box>
              </TableCell>
              <TableCell><PildoraEstado statusId={u.status_id} /></TableCell>
              <TableCell align="center"><BotonIcono titulo={`Editar ${u.username}`} onClick={() => onEditar(u)}><EditIcon /></BotonIcono></TableCell>
              <TableCell align="center">
                <BotonIcono titulo={`Eliminar ${u.username}`} tono="eliminar" disabled={u.status_id !== REGISTRO.ACTIVO || u.id === yo.id} onClick={() => onEliminar(u)}><DeleteIcon /></BotonIcono>
              </TableCell>
            </TableRow>
          ))}
          {visibles.length === 0 && <TableRow><TableCell colSpan={9} align="center" sx={{ py: 3.5 }}>Sin resultados.</TableCell></TableRow>}
        </TableBody>
      </TablaConfig>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography sx={{ fontSize: 13 }}>
          {filtrados.length === 0 ? `0 de ${usuarios.length} usuarios` : `Mostrando ${desde + 1}–${desde + visibles.length} de ${filtrados.length} usuarios`}
        </Typography>
        {paginas > 1 && <Pagination count={paginas} page={actual} onChange={(_e, p) => setPagina(p)} size="small" color="primary" shape="rounded" />}
      </Box>
    </TarjetaConfig>
  );
}

export default function UsuariosPage({ alta = false }: { alta?: boolean }) {
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const cache = useQueryClient();
  const usuarios = useQuery({ queryKey: ['usuarios'], queryFn: () => api.get<Usuario[]>('/admin/usuarios') });
  const [editando, setEditando] = useState<Borrador | null>(alta ? NUEVO : null);
  // Al venir de `/admin/usuarios/nuevo` el aviso llega en el estado de la navegación.
  const [mensaje, setMensaje] = useState<Mensaje | null>((ubicacion.state as { mensaje?: Mensaje } | null)?.mensaje ?? null);
  const [aEliminar, setAEliminar] = useState<Usuario | null>(null);

  const eliminar = useMutation({
    mutationFn: (u: Usuario) => api.delete(`/admin/usuarios/${u.id}`),
    onSuccess: (_r, u) => {
      setMensaje({ tipo: 'ok', texto: `Usuario ${u.username} inactivado. Su historial de gestión se conserva.` });
      setAEliminar(null);
      void cache.invalidateQueries({ queryKey: ['usuarios'] });
    },
    onError: (e) => { setAEliminar(null); setMensaje({ tipo: 'error', texto: mensajeDe(e) }); },
  });
  const volver = (m?: Mensaje) => {
    setEditando(null);
    if (alta) void navegar('/admin/usuarios', { state: m ? { mensaje: m } : null });
  };

  const hero = editando === null
    ? { miga: 'Configuración / Usuarios', titulo: 'Bandeja de usuarios', subtitulo: 'Gestiona los usuarios, roles y servicios de cada campaña.' }
    : editando.id === null
      ? { miga: 'Configuración / Usuarios / Nuevo', titulo: 'Nuevo usuario', subtitulo: 'Registra un operador, supervisor o administrador y asígnale su campaña principal.' }
      : { miga: 'Configuración / Usuarios / Edición', titulo: 'Edición de usuario', subtitulo: 'Modifica sus datos, rol, estatus y campaña principal.' };

  return (
    <Pagina {...hero}>
      {mensaje && <Aviso tipo={mensaje.tipo} onCerrar={() => setMensaje(null)}>{mensaje.texto}</Aviso>}
      {editando ? (
        <Formulario
          key={editando.id ?? 'nuevo'} inicial={editando} onVolver={() => volver()}
          onMensaje={(m, salir) => { setMensaje(m); if (salir) volver(m); }}
        />
      ) : (
        <Consulta query={usuarios}>
          {(lista) => (
            <Lista
              usuarios={lista} onNuevo={() => { setMensaje(null); setEditando(NUEVO); }} onEliminar={setAEliminar}
              onEditar={(u) => { setMensaje(null); setEditando({ id: u.id, nombre: u.nombre, apellido: u.apellido, username: u.username, password: '', usertype_id: String(u.usertype_id), status_id: String(u.status_id), servicio_id: String(u.servicio_id) }); }}
            />
          )}
        </Consulta>
      )}
      <Confirmacion
        abierto={aEliminar !== null} titulo="Eliminar usuario" peligro confirmar="Eliminar" ocupado={eliminar.isPending}
        texto={<>El usuario <strong>{aEliminar?.username}</strong> quedará inactivo y no podrá iniciar sesión. Su historial de gestión se conserva.</>}
        onCerrar={() => setAEliminar(null)} onConfirmar={() => aEliminar && eliminar.mutate(aEliminar)}
      />
    </Pagina>
  );
}
