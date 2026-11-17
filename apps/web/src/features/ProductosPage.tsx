/**
 * Productos: edición de los activos y registro de un catálogo nuevo por campaña.
 */
import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FLUJO } from '@bulkapp/shared';
import { api, mensajeDe } from '../shared/api.ts';
import { opcionesCampana, useCampanas } from '../shared/datos.tsx';
import { Consulta, Pagina, Seccion, Selector, Vacio, useAvisos } from '../shared/ui.tsx';

interface Producto { id: number; descripcion: string; codigo_producto: string | null; costo_prod: string | null; fecha: string; codplan: string; servicio_id: number; servicio: string }
interface Fila { descripcion: string; codigo_producto: string; costo_prod: string; codplan: string }
type CampoFila = keyof Fila;

const FILA_VACIA: Fila = { descripcion: '', codigo_producto: '', costo_prod: '', codplan: '' };
const COLUMNAS: Array<{ k: CampoFila; titulo: string; max: number; ancho?: number }> = [
  { k: 'descripcion', titulo: 'Nombre', max: 100 }, { k: 'codigo_producto', titulo: 'Código', max: 11, ancho: 130 },
  { k: 'costo_prod', titulo: 'Costo', max: 11, ancho: 130 }, { k: 'codplan', titulo: 'Plan', max: 10, ancho: 120 },
];

function Celdas({ fila, onChange, etiqueta }: { fila: Fila; onChange: (k: CampoFila, v: string) => void; etiqueta: string }) {
  return (
    <>
      {COLUMNAS.map((c) => (
        <TableCell key={c.k} sx={{ width: c.ancho, py: 0.5 }}>
          <TextField
            value={fila[c.k]} onChange={(e) => onChange(c.k, e.target.value)} fullWidth variant="standard"
            slotProps={{ htmlInput: { maxLength: c.max, 'aria-label': `${c.titulo} de ${etiqueta}`, inputMode: c.k === 'costo_prod' ? 'decimal' : 'text' } }}
          />
        </TableCell>
      ))}
    </>
  );
}

function NuevoCatalogo({ onCerrar }: { onCerrar: () => void }) {
  const avisos = useAvisos();
  const cache = useQueryClient();
  const campanas = useCampanas({ flujo: FLUJO.BANCARIO, activas: true });
  const [servicioId, setServicioId] = useState('');
  const [filas, setFilas] = useState<Fila[]>([{ ...FILA_VACIA }]);

  const guardar = useMutation({
    mutationFn: () => api.post('/admin/productos', { servicio_id: servicioId, productos: filas.filter((f) => f.descripcion.trim() !== '') }),
    onSuccess: () => {
      avisos.ok('Catálogo de productos registrado.');
      void cache.invalidateQueries({ queryKey: ['productos'] });
      onCerrar();
    },
  });

  return (
    <Dialog open onClose={guardar.isPending ? undefined : onCerrar} maxWidth="md" fullWidth>
      <DialogTitle>Nuevo catálogo de productos</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity="warning">Al guardar, los productos activos actuales de la campaña pasan a inactivos y quedan vigentes solo los de esta lista.</Alert>
          {guardar.isError && <Alert severity="error">{mensajeDe(guardar.error)}</Alert>}
          <Selector label="Campaña" required value={servicioId} vacio="Selecciona…" opciones={opcionesCampana(campanas.data)} onChange={(e) => setServicioId(e.target.value)} sx={{ maxWidth: 420 }} />
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow>{COLUMNAS.map((c) => <TableCell key={c.k}>{c.titulo}</TableCell>)}<TableCell /></TableRow></TableHead>
              <TableBody>
                {filas.map((f, i) => (
                  <TableRow key={i}>
                    <Celdas fila={f} etiqueta={`producto ${i + 1}`} onChange={(k, v) => setFilas(filas.map((x, j) => (j === i ? { ...x, [k]: v } : x)))} />
                    <TableCell sx={{ width: 48 }}>
                      <IconButton size="small" aria-label={`Quitar producto ${i + 1}`} disabled={filas.length === 1} onClick={() => setFilas(filas.filter((_x, j) => j !== i))}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Button startIcon={<AddIcon />} onClick={() => setFilas([...filas, { ...FILA_VACIA }])} sx={{ alignSelf: 'flex-start' }}>Agregar producto</Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar} disabled={guardar.isPending}>Cancelar</Button>
        <Button variant="contained" loading={guardar.isPending} disabled={servicioId === '' || filas.every((f) => f.descripcion.trim() === '')} onClick={() => guardar.mutate()}>Guardar catálogo</Button>
      </DialogActions>
    </Dialog>
  );
}

function Activos({ productos }: { productos: Producto[] }) {
  const avisos = useAvisos();
  const cache = useQueryClient();
  const [cambios, setCambios] = useState<Record<number, Fila>>({});

  const filaDe = (p: Producto): Fila => cambios[p.id] ?? { descripcion: p.descripcion, codigo_producto: p.codigo_producto ?? '', costo_prod: p.costo_prod ?? '', codplan: p.codplan };
  const guardar = useMutation({
    mutationFn: () => api.put('/admin/productos', { productos: Object.entries(cambios).map(([id, f]) => ({ id: Number(id), ...f })) }),
    onSuccess: async () => {
      avisos.ok('Productos actualizados.');
      await cache.invalidateQueries({ queryKey: ['productos'] });
      setCambios({});
    },
    onError: (e) => avisos.error(e),
  });
  const pendientes = Object.keys(cambios).length;

  if (productos.length === 0) return <Vacio>No hay productos activos. Registra un catálogo para una campaña.</Vacio>;
  return (
    <>
      <TableContainer>
        <Table size="small">
          <TableHead><TableRow><TableCell>Campaña</TableCell>{COLUMNAS.map((c) => <TableCell key={c.k}>{c.titulo}</TableCell>)}<TableCell>Desde</TableCell></TableRow></TableHead>
          <TableBody>
            {productos.map((p) => (
              <TableRow key={p.id} hover selected={p.id in cambios}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{p.servicio}</TableCell>
                <Celdas fila={filaDe(p)} etiqueta={p.descripcion} onChange={(k, v) => setCambios({ ...cambios, [p.id]: { ...filaDe(p), [k]: v } })} />
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{p.fecha}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
        <Button variant="contained" disabled={pendientes === 0} loading={guardar.isPending} onClick={() => guardar.mutate()}>
          Guardar cambios{pendientes > 0 ? ` (${pendientes})` : ''}
        </Button>
        <Button disabled={pendientes === 0 || guardar.isPending} onClick={() => setCambios({})}>Descartar</Button>
      </Stack>
    </>
  );
}

export default function ProductosPage() {
  const productos = useQuery({ queryKey: ['productos'], queryFn: () => api.get<Producto[]>('/admin/productos') });
  const [nuevo, setNuevo] = useState(false);
  return (
    <Pagina titulo="Productos" subtitulo="Productos activos por campaña." acciones={<Button variant="contained" startIcon={<AddIcon />} onClick={() => setNuevo(true)}>Nuevo catálogo</Button>}>
      <Seccion>
        <Consulta query={productos}>{(lista) => <Activos productos={lista} />}</Consulta>
      </Seccion>
      {nuevo && <NuevoCatalogo onCerrar={() => setNuevo(false)} />}
    </Pagina>
  );
}
