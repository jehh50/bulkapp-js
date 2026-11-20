/**
 * Constructor de formularios dinámicos: listado con el mismo flujo que el PHP
 * (buscar, filtrar por estado, vista previa, editar, activar/desactivar y eliminar).
 * El editor (asistente de 3 pasos) vive en ConstructorEditor.tsx.
 */
import { useState } from 'react';
import { Box, Button, Grid, IconButton, InputLabel, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/EditOutlined';
import PauseIcon from '@mui/icons-material/PauseOutlined';
import PlayIcon from '@mui/icons-material/PlayArrowOutlined';
import PreviewIcon from '@mui/icons-material/VisibilityOutlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { REGISTRO } from '@bulkapp/shared';
import { ApiError, api } from '../shared/api.ts';
import { Tabla } from '../shared/datos.tsx';
import { SOMBRA } from '../shared/tema.ts';
import { Confirmacion, Consulta, Pagina, Selector, fechaHora, useAvisos } from '../shared/ui.tsx';
import { EditorFormulario, ListaConflictos, PildoraEstado, VistaPreviaDialog, type Conflicto, type Detalle } from './ConstructorEditor.tsx';

interface FormularioFila {
  id: number; nombre: string; status_id: number; actualizado: string; version_vigente: number | null; num_campos: number; filas_bd: number | null;
  servicios: Array<{ id: number; descripcion: string }>;
}

const etiquetaFiltro = { fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', color: 'text.primary', mb: 0.5 } as const;

export default function ConstructorPage() {
  const avisos = useAvisos();
  const cache = useQueryClient();
  const formularios = useQuery({ queryKey: ['constructor', 'formularios'], queryFn: () => api.get<FormularioFila[]>('/constructor/formularios') });
  const [editando, setEditando] = useState<number | 'nuevo' | null>(null);
  const [buscar, setBuscar] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [aEliminar, setAEliminar] = useState<FormularioFila | null>(null);
  const [aCambiar, setACambiar] = useState<FormularioFila | null>(null);
  const [conflicto, setConflicto] = useState<{ form: FormularioFila; conflictos: Conflicto[] } | null>(null);
  const [previa, setPrevia] = useState<Detalle | null>(null);

  const refrescar = () => cache.invalidateQueries({ queryKey: ['constructor'] });

  // Cambio de estado desde el listado: no crea versión.
  const estado = useMutation({
    mutationFn: (v: { form: FormularioFila; reasignar?: boolean }) =>
      api.patch(`/constructor/formularios/${v.form.id}/estado`, {
        status_id: v.form.status_id === REGISTRO.ACTIVO ? REGISTRO.INACTIVO : REGISTRO.ACTIVO, reasignar: v.reasignar === true,
      }),
    onSuccess: (_r, v) => {
      avisos.ok(v.form.status_id === REGISTRO.ACTIVO ? 'Formulario desactivado.' : 'Formulario activado.');
      setACambiar(null);
      setConflicto(null);
      void refrescar();
    },
    onError: (e, v) => {
      setACambiar(null);
      if (e instanceof ApiError && e.code === 'conflicto') setConflicto({ form: v.form, conflictos: (e.datos.conflictos as Conflicto[] | undefined) ?? [] });
      else avisos.error(e);
    },
  });
  const eliminar = useMutation({
    mutationFn: (f: FormularioFila) => api.delete(`/constructor/formularios/${f.id}`),
    onSuccess: () => {
      avisos.ok('Formulario eliminado.');
      setAEliminar(null);
      void refrescar();
    },
    onError: (e) => avisos.error(e),
  });
  const verPrevia = useMutation({
    mutationFn: (id: number) => api.get<Detalle>(`/constructor/formularios/${id}`),
    onSuccess: setPrevia,
    onError: (e) => avisos.error(e),
  });

  if (editando !== null) {
    return <EditorFormulario key={editando} id={editando === 'nuevo' ? null : editando} onVolver={() => { setEditando(null); void refrescar(); }} />;
  }

  const activar = aCambiar !== null && aCambiar.status_id !== REGISTRO.ACTIVO;

  return (
    <Pagina titulo="Constructor de formularios" subtitulo="Crea, versiona y asigna formularios dinámicos a los servicios.">
      <Paper variant="outlined" sx={{ p: { xs: 2, md: '20px 24px' }, mb: 2.5, boxShadow: SOMBRA.elevada }}>
        <Grid container spacing={2} sx={{ alignItems: 'flex-end' }}>
          <Grid size={{ xs: 12, lg: 5 }}>
            <InputLabel htmlFor="cnsSearch" sx={etiquetaFiltro}>Buscar</InputLabel>
            <TextField id="cnsSearch" fullWidth value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Nombre del formulario…" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <InputLabel htmlFor="cnsFiltroEstado" sx={etiquetaFiltro}>Estado</InputLabel>
            <Selector
              id="cnsFiltroEstado" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} vacio="Todos"
              opciones={[{ value: String(REGISTRO.ACTIVO), label: 'Activo' }, { value: String(REGISTRO.INACTIVO), label: 'Inactivo' }]}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 4 }} sx={{ textAlign: { sm: 'right' } }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditando('nuevo')} sx={{ height: 42 }}>Nuevo formulario</Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Consulta query={formularios}>
          {(lista) => {
            const termino = buscar.trim().toLowerCase();
            const visibles = lista.filter((f) => (!termino || f.nombre.toLowerCase().includes(termino)) && (!filtroEstado || String(f.status_id) === filtroEstado));
            return (
              <Tabla
                filas={visibles} clave={(f) => f.id} vacio="No hay formularios para mostrar."
                columnas={[
                  { titulo: 'Formulario', celda: (f) => <strong>{f.nombre}</strong> },
                  { titulo: 'Servicios', celda: (f) => (f.servicios.length === 0 ? '—' : f.servicios.map((s) => s.descripcion).join(', ')) },
                  { titulo: 'Campos', numerica: true, celda: (f) => f.num_campos },
                  { titulo: 'Versión', numerica: true, celda: (f) => f.version_vigente ?? '—' },
                  { titulo: 'Estado', celda: (f) => <PildoraEstado activo={f.status_id === REGISTRO.ACTIVO} /> },
                  { titulo: 'Actualizado', celda: (f) => <Box component="span" sx={{ whiteSpace: 'nowrap' }}>{fechaHora(f.actualizado)}</Box> },
                  { titulo: 'Acciones', celda: (f) => {
                    const activo = f.status_id === REGISTRO.ACTIVO;
                    const borde = { border: 1, borderRadius: '8px' } as const;
                    return (
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Vista previa">
                          <IconButton size="small" sx={{ ...borde, color: 'text.secondary' }} aria-label={`Vista previa de ${f.nombre}`} disabled={verPrevia.isPending} onClick={() => verPrevia.mutate(f.id)}>
                            <PreviewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Editar">
                          <IconButton size="small" color="primary" sx={borde} aria-label={`Editar ${f.nombre}`} onClick={() => setEditando(f.id)}><EditIcon fontSize="small" /></IconButton>
                        </Tooltip>
                        {/* El ícono muestra la acción: pausa para desactivar uno activo, play para activar uno inactivo. */}
                        <Tooltip title={activo ? 'Desactivar' : 'Activar'}>
                          <IconButton size="small" color={activo ? 'warning' : 'success'} sx={borde} aria-label={activo ? 'Desactivar' : 'Activar'} onClick={() => setACambiar(f)}>
                            {activo ? <PauseIcon fontSize="small" /> : <PlayIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                        {/* Un formulario activo no se elimina: primero hay que desactivarlo. */}
                        <Tooltip title={activo ? 'Desactívalo para poder eliminarlo' : 'Eliminar'}>
                          <span>
                            <IconButton size="small" color="error" sx={borde} aria-label={activo ? 'Eliminar (desactívalo primero)' : 'Eliminar'} disabled={activo} onClick={() => setAEliminar(f)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    );
                  } },
                ]}
              />
            );
          }}
        </Consulta>
      </Paper>

      <Confirmacion
        abierto={aCambiar !== null} titulo={activar ? 'Activar formulario' : 'Desactivar formulario'} confirmar={activar ? 'Activar' : 'Desactivar'}
        ocupado={estado.isPending} onCerrar={() => setACambiar(null)} onConfirmar={() => aCambiar && estado.mutate({ form: aCambiar })}
        texto={(
          <>
            <Typography sx={{ mb: 1 }}>{activar ? '¿Activar' : '¿Desactivar'} <strong>{aCambiar?.nombre}</strong>?</Typography>
            <Typography variant="body2" color="text.secondary">
              {activar ? 'Los operadores de las campañas asignadas lo verán y lo usarán de inmediato.' : 'Los operadores dejarán de verlo de inmediato. Sus datos e historial se conservan.'}
            </Typography>
            {activar && aCambiar?.servicios.length === 0 && (
              <Typography variant="body2" sx={{ mt: 2, p: 1.5, borderRadius: '10px', bgcolor: '#fff4e5', color: '#663c00' }}>
                No tiene campañas asignadas: aunque quede activo, ningún operador lo verá.
              </Typography>
            )}
          </>
        )}
      />
      <Confirmacion
        abierto={conflicto !== null} titulo="Conflicto de servicios" confirmar="Reasignar y activar" ocupado={estado.isPending}
        texto={<><ListaConflictos conflictos={conflicto?.conflictos ?? []} /><Typography variant="body2" sx={{ mt: 1 }}>¿Reasignarlos a este formulario?</Typography></>}
        onCerrar={() => setConflicto(null)} onConfirmar={() => conflicto && estado.mutate({ form: conflicto.form, reasignar: true })}
      />
      <Confirmacion
        abierto={aEliminar !== null} titulo="Eliminar formulario" peligro confirmar="Eliminar" ocupado={eliminar.isPending}
        texto={<>¿Eliminar <strong>{aEliminar?.nombre}</strong>? Los datos del formulario e historial se conservan para reportería.</>}
        onCerrar={() => setAEliminar(null)} onConfirmar={() => aEliminar && eliminar.mutate(aEliminar)}
      />
      <VistaPreviaDialog
        abierto={previa !== null} nombre={previa?.formulario.nombre ?? ''} definicion={previa?.formulario.definicion ?? { campos: [] }}
        bd={previa?.bd ?? null} onCerrar={() => setPrevia(null)}
      />
    </Pagina>
  );
}
