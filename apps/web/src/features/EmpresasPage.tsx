/**
 * Clientes y campañas con el diseño de `views/empresas/index.php` + `empresas.js`:
 * listado con buscador y filtro de estado → ficha del cliente (datos editables en
 * línea + tabla de campañas) → ventanas de campaña y de usuarios asignados.
 */
import { useState, type FormEvent, type ReactNode } from 'react';
import {
  Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Grid, IconButton, MenuItem, Switch,
  TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, Table,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/EditOutlined';
import GroupIcon from '@mui/icons-material/GroupOutlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FLUJO, REGISTRO, ROL_NOMBRE, validarCampana, validarEmpresa, type Flujo } from '@bulkapp/shared';
import { api, mensajeDe } from '../shared/api.ts';
import { BOTON_DORADO, BotonIcono, ErrorForm, Ficha, PildoraEstado, SubCelda } from '../shared/config.tsx';
import { CampoFiltro, SinDatos, TarjetaDatos, TarjetaFiltros } from '../shared/graficos.tsx';
import { MARCA } from '../shared/tema.ts';
import { Consulta, Pagina, fechaLarga, hoy, numero, useAvisos } from '../shared/ui.tsx';

interface Empresa { id: number; nombre: string; identificacion: string | null; status_id: number; campanas?: number; campanas_activas?: number; usuarios?: number }
interface Campana {
  id: number; nombre: string; detalle: string | null; fecha_inicio: string; meta: number | null; tipo_flujo: Flujo; codigo: string; status_id: number;
  usuarios: number; productos: number;
}
interface UsuarioCampana { id: number; username: string; nombre: string; apellido: string; usertype_id: number; asignado: boolean; principal: boolean }

const ACTIVO = REGISTRO.ACTIVO;
const INACTIVO = REGISTRO.INACTIVO;
const MIGA = 'Configuración / Clientes y campañas';

/** `.emp-flujo`: bancario en azul, dinámico en dorado. */
function PildoraFlujo({ flujo }: { flujo: Flujo }) {
  const bancario = flujo === FLUJO.BANCARIO;
  return (
    <Box component="span" sx={{ fontSize: 11.5, fontWeight: 600, borderRadius: '20px', px: 1.25, py: 0.25, whiteSpace: 'nowrap', ...(bancario ? { bgcolor: '#e8eefb', color: MARCA.azul700 } : { bgcolor: '#fdf0cf', color: '#8a5a00' }) }}>
      {bancario ? 'Formulario bancario' : 'Formulario dinámico'}
    </Box>
  );
}

/** Interruptor Activo/Inactivo (`.emp-switch`). */
function Interruptor({ id, activo, femenino, onCambio }: { id: string; activo: boolean; femenino?: boolean; onCambio: (v: boolean) => void }) {
  const texto = activo ? (femenino ? 'Activa' : 'Activo') : (femenino ? 'Inactiva' : 'Inactivo');
  return <FormControlLabel sx={{ height: 42, m: 0 }} control={<Switch id={id} checked={activo} onChange={(e) => onCambio(e.target.checked)} />} label={texto} />;
}

/** Cabecera de una tarjeta de datos con título, subtítulo y acción (`.emp-card-head`). */
function CabeceraTarjeta({ titulo, sub, accion }: { titulo: string; sub: string; accion: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', px: 3, py: 2.25 }}>
      <Box>
        <Typography sx={{ fontWeight: 600, fontSize: 16 }}>{titulo}</Typography>
        <Typography sx={{ fontSize: 13, color: '#6b7280' }}>{sub}</Typography>
      </Box>
      {accion}
    </Box>
  );
}

const etiquetaModal = (texto: ReactNode, htmlFor: string) => <Typography component="label" htmlFor={htmlFor} sx={{ display: 'block', fontWeight: 600, fontSize: 14, mb: 0.75 }}>{texto}</Typography>;
const opcional = (t = '(opcional)') => <Box component="span" sx={{ color: '#6b7280', fontWeight: 400 }}>{t}</Box>;

// --- Ventana de campaña ------------------------------------------------------------------

function EditorCampana({ empresa, campana, onCerrar }: { empresa: Empresa; campana: Campana | null; onCerrar: () => void }) {
  const avisos = useAvisos();
  const cache = useQueryClient();
  const esNueva = campana === null;
  const [b, setB] = useState({
    nombre: campana?.nombre ?? '', detalle: campana?.detalle ?? '', fecha_inicio: campana?.fecha_inicio ?? hoy(), meta: campana?.meta != null ? String(campana.meta) : '',
    tipo_flujo: campana?.tipo_flujo ?? FLUJO.DINAMICO, codigo: campana?.codigo ?? '', status_id: String(campana?.status_id ?? ACTIVO),
  });
  const [error, setError] = useState<string | null>(null);
  const bancario = b.tipo_flujo === FLUJO.BANCARIO;

  const guardar = useMutation({
    mutationFn: () => (campana ? api.put(`/organizacion/empresas/${empresa.id}/campanas/${campana.id}`, b) : api.post(`/organizacion/empresas/${empresa.id}/campanas`, b)),
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
    <Dialog open onClose={guardar.isPending ? undefined : onCerrar} maxWidth="md" fullWidth>
      <form onSubmit={enviar} noValidate>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {esNueva ? `Nueva campaña · ${empresa.nombre}` : `Editar campaña · ${campana.nombre}`}
          <IconButton aria-label="Cerrar" onClick={onCerrar}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 8 }}>
              {etiquetaModal('Nombre', 'campNombre')}
              <TextField id="campNombre" fullWidth autoFocus value={b.nombre} placeholder="Ej: Venta de planes odontológicos" onChange={(e) => setB({ ...b, nombre: e.target.value })} slotProps={{ htmlInput: { maxLength: 50 } }} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              {etiquetaModal('Fecha de inicio', 'campFecha')}
              <TextField id="campFecha" type="date" fullWidth value={b.fecha_inicio} onChange={(e) => setB({ ...b, fecha_inicio: e.target.value })} />
            </Grid>
            <Grid size={12}>
              {etiquetaModal('Descripción', 'campDetalle')}
              <TextField id="campDetalle" fullWidth multiline minRows={3} value={b.detalle} placeholder="Objetivo, público, condiciones…" onChange={(e) => setB({ ...b, detalle: e.target.value })} slotProps={{ htmlInput: { maxLength: 500 } }} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              {etiquetaModal(<>Meta {opcional()}</>, 'campMeta')}
              <TextField id="campMeta" type="number" fullWidth value={b.meta} placeholder="Ej: 500" onChange={(e) => setB({ ...b, meta: e.target.value })} slotProps={{ htmlInput: { min: 1, step: 1 } }} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              {etiquetaModal('Flujo', 'campFlujo')}
              <TextField id="campFlujo" select fullWidth value={b.tipo_flujo} disabled={!esNueva} onChange={(e) => setB({ ...b, tipo_flujo: e.target.value as Flujo })}>
                <MenuItem value={FLUJO.DINAMICO}>Formulario dinámico</MenuItem>
                <MenuItem value={FLUJO.BANCARIO}>Formulario bancario</MenuItem>
              </TextField>
              <Typography sx={{ fontSize: 12.5, color: '#6b7280', mt: 0.5 }}>{esNueva ? 'Se fija al crear la campaña.' : 'El flujo no se modifica una vez creada la campaña.'}</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              {etiquetaModal(<>Código {opcional(bancario ? '(obligatorio)' : '(opcional)')}</>, 'campCodigo')}
              <TextField id="campCodigo" fullWidth value={b.codigo} placeholder="Ej: 17" onChange={(e) => setB({ ...b, codigo: e.target.value.toUpperCase() })} slotProps={{ htmlInput: { maxLength: 10 } }} />
              <Typography sx={{ fontSize: 12.5, color: '#6b7280', mt: 0.5 }}>Company code del XML en campañas bancarias.</Typography>
            </Grid>
            <Grid size={12}>
              <Interruptor id="campEstado" femenino activo={b.status_id === String(ACTIVO)} onCambio={(v) => setB({ ...b, status_id: String(v ? ACTIVO : INACTIVO) })} />
            </Grid>
          </Grid>
          {error && <Box sx={{ mt: 2 }}><ErrorForm>{error}</ErrorForm></Box>}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={onCerrar} disabled={guardar.isPending}>Cancelar</Button>
          <Button type="submit" variant="contained" loading={guardar.isPending}>Guardar campaña</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

// --- Ventana de usuarios -------------------------------------------------------------------

function Asignados({ usuarios, campanaId, onCerrar }: { usuarios: UsuarioCampana[]; campanaId: number; onCerrar: () => void }) {
  const avisos = useAvisos();
  const cache = useQueryClient();
  const [marcados, setMarcados] = useState(() => new Set(usuarios.filter((u) => u.asignado).map((u) => u.id)));
  const [filtro, setFiltro] = useState('');
  const [soloAsignados, setSoloAsignados] = useState(false);

  const guardar = useMutation({
    mutationFn: () => api.put<{ agregados: number; quitados: number; principal_movida: number; bloqueados: Array<{ username: string }> }>(`/organizacion/campanas/${campanaId}/usuarios`, { usuarios: [...marcados] }),
    onSuccess: (r) => {
      if (r.bloqueados.length > 0) avisos.error(`No se pudo quitar a ${r.bloqueados.map((x) => x.username).join(', ')}: es su única campaña.`);
      else avisos.ok(`Asignación guardada: ${r.agregados} agregados, ${r.quitados} quitados.`);
      void cache.invalidateQueries({ queryKey: ['empresas'] });
      void cache.invalidateQueries({ queryKey: ['usuarios'] });
      onCerrar();
    },
    onError: (e) => avisos.error(e),
  });
  const alternar = (id: number) => {
    const s = new Set(marcados);
    if (!s.delete(id)) s.add(id);
    setMarcados(s);
  };
  const termino = filtro.trim().toLowerCase();
  const visibles = usuarios.filter((u) => (!soloAsignados || marcados.has(u.id))
    && (termino === '' || `${u.nombre} ${u.apellido} ${u.username} ${ROL_NOMBRE[u.usertype_id] ?? ''}`.toLowerCase().includes(termino)));

  return (
    <>
      <DialogContent dividers>
        <Grid container spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
          <Grid size={{ xs: 12, md: 7 }}>
            <TextField fullWidth value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar por nombre, usuario o rol…" slotProps={{ htmlInput: { 'aria-label': 'Buscar usuarios' } }} />
          </Grid>
          <Grid size={{ xs: 12, md: 5 }} sx={{ display: 'flex', justifyContent: { md: 'flex-end' }, alignItems: 'center', gap: 2 }}>
            <FormControlLabel sx={{ m: 0, '& .MuiTypography-root': { fontSize: 13 } }} control={<Switch size="small" checked={soloAsignados} onChange={(e) => setSoloAsignados(e.target.checked)} />} label="Solo asignados" />
            <Ficha>{marcados.size} {marcados.size === 1 ? 'asignado' : 'asignados'}</Ficha>
          </Grid>
        </Grid>
        <Box sx={{ border: `1px solid ${MARCA.linea}`, borderRadius: '12px', maxHeight: '50vh', overflowY: 'auto' }}>
          {visibles.length === 0 && <Box sx={{ textAlign: 'center', color: '#6b7280', p: 4 }}>Sin resultados.</Box>}
          {visibles.map((u, i) => (
            <Box
              key={u.id} component="label"
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.75, py: 1, borderTop: i === 0 ? 0 : `1px solid ${MARCA.linea}`, cursor: 'pointer', '&:hover': { bgcolor: '#f7f9fc' } }}
            >
              <Checkbox size="small" checked={marcados.has(u.id)} onChange={() => alternar(u.id)} sx={{ p: 0.5 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 500, fontSize: 14 }}>{u.nombre} {u.apellido}</Typography>
                <Typography sx={{ fontSize: 12, color: '#6b7280' }}>{u.username}</Typography>
              </Box>
              {u.principal && <Ficha tono="dorado">Principal</Ficha>}
              <Ficha>{ROL_NOMBRE[u.usertype_id] ?? ''}</Ficha>
            </Box>
          ))}
        </Box>
        <Typography sx={{ fontSize: 13, color: '#6b7280', mt: 1 }}>
          La campaña <strong>principal</strong> es con la que el usuario inicia sesión. Si lo quitas de su principal, pasa a otra de sus campañas; si no tiene otra, se mantiene asignado.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onCerrar} disabled={guardar.isPending}>Cancelar</Button>
        <Button variant="contained" loading={guardar.isPending} onClick={() => guardar.mutate()}>Guardar asignación</Button>
      </DialogActions>
    </>
  );
}

function DialogoUsuarios({ empresa, campana, onCerrar }: { empresa: Empresa; campana: Campana; onCerrar: () => void }) {
  const consulta = useQuery({
    queryKey: ['empresas', 'usuarios', campana.id], gcTime: 0, staleTime: 0,
    queryFn: () => api.get<{ usuarios: UsuarioCampana[] }>(`/organizacion/campanas/${campana.id}/usuarios`),
  });
  return (
    <Dialog open onClose={onCerrar} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          Usuarios asignados
          <Typography sx={{ fontSize: 13, color: '#6b7280' }}>{empresa.nombre} › {campana.nombre}</Typography>
        </Box>
        <IconButton aria-label="Cerrar" onClick={onCerrar}><CloseIcon /></IconButton>
      </DialogTitle>
      {consulta.data
        ? <Asignados usuarios={consulta.data.usuarios} campanaId={campana.id} onCerrar={onCerrar} />
        : <DialogContent><Consulta query={consulta}>{() => null}</Consulta></DialogContent>}
    </Dialog>
  );
}

// --- Ficha del cliente ---------------------------------------------------------------------

/** Datos del cliente editables en línea; con `empresa` null es el alta. */
function DatosCliente({ empresa, resumen, onVolver, onGuardado }: { empresa: Empresa | null; resumen?: string; onVolver: () => void; onGuardado: (id: number) => void }) {
  const avisos = useAvisos();
  const cache = useQueryClient();
  const [b, setB] = useState({ nombre: empresa?.nombre ?? '', identificacion: empresa?.identificacion ?? '', status_id: String(empresa?.status_id ?? ACTIVO) });
  const [error, setError] = useState<string | null>(null);
  const guardar = useMutation({
    mutationFn: () => (empresa ? api.put<{ id?: number; campanas_inactivadas: number }>(`/organizacion/empresas/${empresa.id}`, b) : api.post<{ id: number; campanas_inactivadas: number }>('/organizacion/empresas', b)),
    onSuccess: (r) => {
      avisos.ok(r.campanas_inactivadas > 0 ? `Cliente guardado. Se inactivaron ${r.campanas_inactivadas} campañas.` : 'Cliente guardado.');
      void cache.invalidateQueries({ queryKey: ['empresas'] });
      onGuardado(empresa?.id ?? r.id!);
    },
    onError: (e) => setError(mensajeDe(e)),
  });
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const v = validarEmpresa(b);
    setError(v.ok ? null : v.errores.join(' '));
    if (v.ok) guardar.mutate();
  };

  return (
    <TarjetaFiltros>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Button size="small" variant="outlined" onClick={onVolver} sx={{ fontWeight: 600 }}>‹ Clientes</Button>
        {resumen && <Ficha>{resumen}</Ficha>}
      </Box>
      <Grid container spacing={2} component="form" onSubmit={enviar} noValidate sx={{ alignItems: 'flex-end' }}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <CampoFiltro etiqueta="Nombre del cliente" htmlFor="empNombre">
            <TextField id="empNombre" fullWidth autoFocus={!empresa} value={b.nombre} placeholder="Ej: Banco Activo" onChange={(e) => setB({ ...b, nombre: e.target.value })} slotProps={{ htmlInput: { maxLength: 100 } }} />
          </CampoFiltro>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <CampoFiltro etiqueta="RIF (opcional)" htmlFor="empRif">
            <TextField id="empRif" fullWidth value={b.identificacion} placeholder="J-12345678-9" onChange={(e) => setB({ ...b, identificacion: e.target.value.toUpperCase() })} slotProps={{ htmlInput: { maxLength: 20 } }} />
          </CampoFiltro>
        </Grid>
        <Grid size={{ xs: 6, lg: 2 }}>
          <CampoFiltro etiqueta="Estado" htmlFor="empEstado">
            <Interruptor id="empEstado" activo={b.status_id === String(ACTIVO)} onCambio={(v) => setB({ ...b, status_id: String(v ? ACTIVO : INACTIVO) })} />
          </CampoFiltro>
        </Grid>
        <Grid size={{ xs: 6, lg: 2 }}>
          <Button type="submit" variant="contained" fullWidth loading={guardar.isPending} sx={{ height: 42 }}>Guardar</Button>
        </Grid>
      </Grid>
      {empresa && b.status_id === String(INACTIVO) && empresa.status_id === ACTIVO && <Typography sx={{ fontSize: 13, color: '#b45309', mt: 1.5 }}>Al inactivar el cliente se inactivan todas sus campañas.</Typography>}
      {error && <Box sx={{ mt: 2 }}><ErrorForm>{error}</ErrorForm></Box>}
    </TarjetaFiltros>
  );
}

function FichaCliente({ empresaId, onVolver }: { empresaId: number; onVolver: () => void }) {
  const consulta = useQuery({ queryKey: ['empresas', empresaId], queryFn: () => api.get<{ empresa: Empresa; campanas: Campana[] }>(`/organizacion/empresas/${empresaId}`) });
  const [campana, setCampana] = useState<Campana | 'nueva' | null>(null);
  const [usuariosDe, setUsuariosDe] = useState<Campana | null>(null);

  return (
    <Consulta query={consulta}>
      {({ empresa, campanas }) => {
        const activas = campanas.filter((c) => c.status_id === ACTIVO).length;
        return (
          <Pagina miga={`${MIGA} / ${empresa.nombre}`} titulo={empresa.nombre} subtitulo={empresa.identificacion ? `RIF ${empresa.identificacion}` : 'Registra sus campañas y los usuarios asignados a cada una.'}>
            <DatosCliente key={`${empresa.id}-${consulta.dataUpdatedAt}`} empresa={empresa} resumen={`${activas} de ${campanas.length} campaña(s) activa(s)`} onVolver={onVolver} onGuardado={() => undefined} />
            <TarjetaDatos>
              <CabeceraTarjeta
                titulo="Campañas" sub="Cada campaña tiene su propio flujo, productos y usuarios asignados."
                accion={<Button variant="contained" onClick={() => setCampana('nueva')} disabled={empresa.status_id !== ACTIVO} sx={{ height: 42, ...BOTON_DORADO }}>+ Nueva campaña</Button>}
              />
              <TableContainer>
                <Table sx={{ minWidth: 900, '& td': { fontSize: 14 }, '& td:not(:first-of-type), & th:not(:first-of-type)': { textAlign: 'center' }, '& td:first-of-type, & th:first-of-type': { pl: 3 } }}>
                  <TableHead>
                    <TableRow>{['Campaña', 'Flujo', 'Inicio', 'Meta', 'Usuarios', 'Productos', 'Estado', 'Acciones'].map((t) => <TableCell key={t}>{t}</TableCell>)}</TableRow>
                  </TableHead>
                  <TableBody>
                    {campanas.map((c) => (
                      <TableRow key={c.id} hover>
                        <TableCell>
                          <strong>{c.nombre}</strong>
                          {c.detalle && <SubCelda>{c.detalle}</SubCelda>}
                          {c.codigo && <SubCelda>Código {c.codigo}</SubCelda>}
                        </TableCell>
                        <TableCell><PildoraFlujo flujo={c.tipo_flujo} /></TableCell>
                        <TableCell>{fechaLarga(c.fecha_inicio)}</TableCell>
                        <TableCell>{c.meta != null ? numero(c.meta) : '—'}</TableCell>
                        <TableCell>{c.usuarios}</TableCell>
                        <TableCell>{c.productos}</TableCell>
                        <TableCell><PildoraEstado statusId={c.status_id} femenino suave /></TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Box sx={{ display: 'inline-flex', gap: 0.75 }}>
                            <BotonIcono titulo="Usuarios asignados" tono="neutro" onClick={() => setUsuariosDe(c)}><GroupIcon /></BotonIcono>
                            <BotonIcono titulo="Editar campaña" onClick={() => setCampana(c)}><EditIcon /></BotonIcono>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {campanas.length === 0 && <Box sx={{ textAlign: 'center', color: '#6b7280', p: '40px 24px', fontSize: 14 }}>Este cliente aún no tiene campañas.</Box>}
            </TarjetaDatos>
            {campana && <EditorCampana empresa={empresa} campana={campana === 'nueva' ? null : campana} onCerrar={() => setCampana(null)} />}
            {usuariosDe && <DialogoUsuarios empresa={empresa} campana={usuariosDe} onCerrar={() => setUsuariosDe(null)} />}
          </Pagina>
        );
      }}
    </Consulta>
  );
}

// --- Listado ------------------------------------------------------------------------------

export default function EmpresasPage() {
  const empresas = useQuery({ queryKey: ['empresas'], queryFn: () => api.get<Empresa[]>('/organizacion/empresas') });
  const [seleccion, setSeleccion] = useState<number | 'nueva' | null>(null);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');

  if (seleccion === 'nueva') {
    return (
      <Pagina miga={`${MIGA} / Nuevo`} titulo="Nuevo cliente" subtitulo="Registra el cliente; luego podrás crear sus campañas.">
        <DatosCliente empresa={null} onVolver={() => setSeleccion(null)} onGuardado={(id) => setSeleccion(id)} />
        <SinDatos>Guarda el cliente para poder registrar sus campañas.</SinDatos>
      </Pagina>
    );
  }
  if (seleccion !== null) return <FichaCliente empresaId={seleccion} onVolver={() => setSeleccion(null)} />;

  const termino = q.trim().toLowerCase();
  return (
    <Pagina miga={MIGA} titulo="Clientes y campañas" subtitulo="Registra clientes, sus campañas y los usuarios asignados a cada una.">
      <TarjetaFiltros>
        <Grid container spacing={2} sx={{ alignItems: 'flex-end' }}>
          <Grid size={{ xs: 12, lg: 5 }}>
            <CampoFiltro etiqueta="Buscar" htmlFor="empSearch"><TextField id="empSearch" fullWidth value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o RIF del cliente…" /></CampoFiltro>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <CampoFiltro etiqueta="Estado" htmlFor="empFiltroEstado">
              <TextField id="empFiltroEstado" select fullWidth value={estado} onChange={(e) => setEstado(e.target.value)} slotProps={{ select: { displayEmpty: true } }}>
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value={String(ACTIVO)}>Activo</MenuItem>
                <MenuItem value={String(INACTIVO)}>Inactivo</MenuItem>
              </TextField>
            </CampoFiltro>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 4 }} sx={{ textAlign: { lg: 'right' } }}>
            <Button variant="contained" onClick={() => setSeleccion('nueva')} sx={{ height: 42, px: 3 }}>+ Nuevo cliente</Button>
          </Grid>
        </Grid>
      </TarjetaFiltros>

      <Consulta query={empresas}>
        {(lista) => {
          const visibles = lista.filter((e) => (estado === '' || String(e.status_id) === estado)
            && (termino === '' || `${e.nombre} ${e.identificacion ?? ''}`.toLowerCase().includes(termino)));
          return (
            <TarjetaDatos>
              <TableContainer>
                <Table sx={{ minWidth: 640, '& td': { fontSize: 14 }, '& td:not(:first-of-type), & th:not(:first-of-type)': { textAlign: 'center' }, '& td:first-of-type, & th:first-of-type': { pl: 3 } }}>
                  <TableHead>
                    <TableRow>{['Cliente', 'Campañas activas', 'Usuarios asignados', 'Estado', 'Acciones'].map((t) => <TableCell key={t}>{t}</TableCell>)}</TableRow>
                  </TableHead>
                  <TableBody>
                    {visibles.map((e) => (
                      <TableRow key={e.id} hover>
                        <TableCell><strong>{e.nombre}</strong>{e.identificacion && <SubCelda>{e.identificacion}</SubCelda>}</TableCell>
                        <TableCell>{e.campanas_activas ?? 0} / {e.campanas ?? 0}</TableCell>
                        <TableCell>{e.usuarios ?? 0}</TableCell>
                        <TableCell><PildoraEstado statusId={e.status_id} suave /></TableCell>
                        <TableCell>
                          <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => setSeleccion(e.id)} aria-label={`Abrir ficha de ${e.nombre}`}>Abrir</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {visibles.length === 0 && <Box sx={{ textAlign: 'center', color: '#6b7280', p: '40px 24px', fontSize: 14 }}>No hay clientes para mostrar.</Box>}
            </TarjetaDatos>
          );
        }}
      </Consulta>
    </Pagina>
  );
}
