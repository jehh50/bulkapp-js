/**
 * Constructor de formularios dinámicos: listado, cambio de estado y eliminación.
 * El editor vive en ConstructorEditor.tsx.
 */
import { useState } from 'react';
import { Button, Chip, IconButton, Stack, Switch, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/EditOutlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { REGISTRO } from '@bulkapp/shared';
import { ApiError, api } from '../shared/api.ts';
import { Tabla } from '../shared/datos.tsx';
import { Confirmacion, Consulta, Pagina, Seccion, fechaHora, numero, useAvisos } from '../shared/ui.tsx';
import { EditorFormulario, ListaConflictos, type Conflicto } from './ConstructorEditor.tsx';

interface FormularioFila {
  id: number; nombre: string; status_id: number; actualizado: string; version_vigente: number | null; num_campos: number; filas_bd: number | null;
  servicios: Array<{ id: number; descripcion: string }>;
}

export default function ConstructorPage() {
  const avisos = useAvisos();
  const cache = useQueryClient();
  const formularios = useQuery({ queryKey: ['constructor', 'formularios'], queryFn: () => api.get<FormularioFila[]>('/constructor/formularios') });
  const [editando, setEditando] = useState<number | 'nuevo' | null>(null);
  const [aEliminar, setAEliminar] = useState<FormularioFila | null>(null);
  const [conflicto, setConflicto] = useState<{ form: FormularioFila; conflictos: Conflicto[] } | null>(null);

  const refrescar = () => cache.invalidateQueries({ queryKey: ['constructor'] });

  const estado = useMutation({
    mutationFn: (v: { form: FormularioFila; activo: boolean; reasignar?: boolean }) =>
      api.patch(`/constructor/formularios/${v.form.id}/estado`, { status_id: v.activo ? REGISTRO.ACTIVO : REGISTRO.INACTIVO, reasignar: v.reasignar === true }),
    onSuccess: (_r, v) => {
      avisos.ok(v.activo ? 'Formulario activado.' : 'Formulario desactivado.');
      setConflicto(null);
      void refrescar();
    },
    onError: (e, v) => {
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

  if (editando !== null) {
    return <EditorFormulario key={editando} id={editando === 'nuevo' ? null : editando} onVolver={() => { setEditando(null); void refrescar(); }} onCreado={(id) => setEditando(id)} />;
  }

  return (
    <Pagina
      titulo="Constructor de formularios" subtitulo="Formularios dinámicos por campaña. Cada campaña admite un solo formulario activo."
      acciones={<Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditando('nuevo')}>Nuevo formulario</Button>}
    >
      <Seccion>
        <Consulta query={formularios}>
          {(lista) => (
            <Tabla
              filas={lista} clave={(f) => f.id} vacio="Aún no hay formularios. Crea el primero."
              columnas={[
                { titulo: 'Formulario', celda: (f) => <Button size="small" onClick={() => setEditando(f.id)} sx={{ textAlign: 'left' }}>{f.nombre}</Button> },
                { titulo: 'Campañas', celda: (f) => (
                  <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                    {f.servicios.length === 0 ? '—' : f.servicios.map((s) => <Chip key={s.id} size="small" variant="outlined" label={s.descripcion} />)}
                  </Stack>
                ) },
                { titulo: 'Versión', celda: (f) => (f.version_vigente ? `v${f.version_vigente}` : '—') },
                { titulo: 'Campos', numerica: true, celda: (f) => f.num_campos },
                { titulo: 'Filas BD', numerica: true, celda: (f) => (f.filas_bd === null ? '—' : numero(f.filas_bd)) },
                { titulo: 'Actualizado', celda: (f) => fechaHora(f.actualizado) },
                { titulo: 'Activo', celda: (f) => (
                  <Switch
                    size="small" checked={f.status_id === REGISTRO.ACTIVO} disabled={estado.isPending}
                    onChange={(_e, activo) => estado.mutate({ form: f, activo })} slotProps={{ input: { 'aria-label': `Activar ${f.nombre}` } }}
                  />
                ) },
                { titulo: '', ancho: 100, celda: (f) => (
                  <Stack direction="row">
                    <Tooltip title="Editar"><IconButton size="small" aria-label={`Editar ${f.nombre}`} onClick={() => setEditando(f.id)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title={f.status_id === REGISTRO.ACTIVO ? 'Desactívalo para poder eliminarlo' : 'Eliminar'}>
                      <span>
                        <IconButton size="small" color="error" aria-label={`Eliminar ${f.nombre}`} disabled={f.status_id === REGISTRO.ACTIVO} onClick={() => setAEliminar(f)}><DeleteIcon fontSize="small" /></IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                ) },
              ]}
            />
          )}
        </Consulta>
      </Seccion>

      <Confirmacion
        abierto={aEliminar !== null} titulo="Eliminar formulario" peligro confirmar="Eliminar" ocupado={eliminar.isPending}
        texto={<>Se eliminará <strong>{aEliminar?.nombre}</strong>. Los registros ya capturados se conservan en los reportes.</>}
        onCerrar={() => setAEliminar(null)} onConfirmar={() => aEliminar && eliminar.mutate(aEliminar)}
      />
      <Confirmacion
        abierto={conflicto !== null} titulo="Campañas con otro formulario activo" confirmar="Reasignar y activar" ocupado={estado.isPending}
        texto={<ListaConflictos conflictos={conflicto?.conflictos ?? []} />}
        onCerrar={() => setConflicto(null)} onConfirmar={() => conflicto && estado.mutate({ form: conflicto.form, activo: true, reasignar: true })}
      />
    </Pagina>
  );
}
