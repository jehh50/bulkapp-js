/**
 * Productos con el diseño de `views/configuracion/index.php` + `productos.js`:
 * lista con buscador, selección múltiple y «Editar seleccionados»; alta de varios
 * productos para un servicio y edición en bloque, en tarjetas «Producto N».
 * El hero cambia según la vista (lista, nuevo, edición), igual que en el PHP.
 */
import { useState, type FormEvent } from 'react';
import { Box, Button, ButtonBase, Checkbox, MenuItem, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/EditOutlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FLUJO } from '@bulkapp/shared';
import { api, mensajeDe } from '../shared/api.ts';
import { useCampanas } from '../shared/datos.tsx';
import { AccionesForm, Aviso, BOTON_DORADO, BotonIcono, Buscador, ErrorForm, Etiqueta, PildoraServicio, TablaConfig, TarjetaConfig } from '../shared/config.tsx';
import { MARCA } from '../shared/tema.ts';
import { Consulta, Pagina } from '../shared/ui.tsx';

interface Producto { id: number; descripcion: string; codigo_producto: string | null; costo_prod: string | null; fecha: string; codplan: string; servicio_id: number; servicio: string }
interface Fila { descripcion: string; codigo_producto: string; costo_prod: string; codplan: string }
type CampoFila = keyof Fila;
type Vista = { modo: 'lista' } | { modo: 'nuevo' } | { modo: 'editar'; productos: Producto[] };

const FILA_VACIA: Fila = { descripcion: '', codigo_producto: '', costo_prod: '', codplan: '' };
const PRECIO = /^\d+(\.\d{1,2})?$/;
const CAMPOS: Array<{ k: CampoFila; titulo: string; max: number; placeholder: string; mayus: boolean }> = [
  { k: 'descripcion', titulo: 'Nombre', max: 100, placeholder: 'PRODUCTO 1', mayus: true },
  { k: 'codigo_producto', titulo: 'Código', max: 11, placeholder: '025', mayus: true },
  { k: 'costo_prod', titulo: 'Precio', max: 11, placeholder: '12345.67', mayus: false },
  { k: 'codplan', titulo: 'Plan', max: 10, placeholder: '54A', mayus: true },
];

const filaDe = (p: Producto): Fila => ({ descripcion: p.descripcion, codigo_producto: p.codigo_producto ?? '', costo_prod: p.costo_prod ?? '', codplan: p.codplan });
/** Mismas validaciones del `productos.js` (todos los campos y precio con 2 decimales). */
function validar(filas: Fila[]): string | null {
  if (filas.some((f) => CAMPOS.some((c) => f[c.k].trim() === ''))) return 'Complete todos los campos de cada producto.';
  if (filas.some((f) => !PRECIO.test(f.costo_prod.trim()))) return 'El precio debe tener el formato 12345.67.';
  return null;
}

/** `.pg-draft`: tarjeta de un producto en edición. */
function Borrador({ n, fila, servicio, onCambio, onQuitar }: { n: number; fila: Fila; servicio?: string; onCambio: (k: CampoFila, v: string) => void; onQuitar?: () => void }) {
  return (
    <Box sx={{ border: '1px solid #dfe5f2', borderRadius: '12px', overflow: 'hidden' }}>
      <Box sx={{ bgcolor: '#f1f4fa', p: '8px 8px 8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 36 }}>
        <Typography sx={{ fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>{servicio !== undefined ? fila.descripcion || `Producto ${n}` : `Producto ${n}`}</Typography>
        {onQuitar && (
          <ButtonBase onClick={onQuitar} sx={{ height: 36, px: 1.75, borderRadius: '8px', bgcolor: '#fde0e0', color: '#b42318', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', '&:hover': { bgcolor: '#f9caca' } }}>
            − Quitar
          </ButtonBase>
        )}
      </Box>
      <Box sx={{ p: '14px 16px', display: 'grid', gap: '12px 14px', gridTemplateColumns: { xs: '1fr 1fr', md: servicio !== undefined ? '1.1fr 2fr 1fr 1fr 1fr' : '3fr 1fr 1fr 1fr' } }}>
        {servicio !== undefined && <Etiqueta texto="Servicio"><TextField value={servicio} slotProps={{ htmlInput: { readOnly: true } }} sx={{ '& input': { bgcolor: '#f3f4f6' } }} /></Etiqueta>}
        {CAMPOS.map((c) => (
          <Box key={c.k} sx={c.k === 'descripcion' ? { gridColumn: { xs: '1 / -1', md: 'auto' } } : undefined}>
            <Etiqueta texto={c.titulo}>
              <TextField
                value={fila[c.k]} required placeholder={c.placeholder}
                onChange={(e) => onCambio(c.k, c.mayus ? e.target.value.toUpperCase() : e.target.value)}
                slotProps={{ htmlInput: { maxLength: c.max, 'aria-label': `${c.titulo} del producto ${n}`, inputMode: c.k === 'costo_prod' ? 'decimal' : 'text' } }}
              />
            </Etiqueta>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function FormNuevo({ onVolver, onListo }: { onVolver: () => void; onListo: (m: string) => void }) {
  const cache = useQueryClient();
  const campanas = useCampanas({ flujo: FLUJO.BANCARIO, activas: true });
  const [servicioId, setServicioId] = useState('');
  const [filas, setFilas] = useState<Fila[]>([{ ...FILA_VACIA }]);
  const [error, setError] = useState<string | null>(null);
  const guardar = useMutation({
    mutationFn: () => api.post('/admin/productos', { servicio_id: servicioId, productos: filas }),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['productos'] });
      onListo('Productos guardados correctamente.');
    },
    onError: (e) => setError(mensajeDe(e)),
  });
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const v = servicioId === '' ? 'Seleccione el servicio.' : validar(filas);
    setError(v);
    if (!v) guardar.mutate();
  };
  return (
    <TarjetaConfig>
      <Box component="form" onSubmit={enviar} noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ maxWidth: 360 }}>
          <Etiqueta texto="Servicio" htmlFor="prodServicio">
            <TextField id="prodServicio" select value={servicioId} onChange={(e) => setServicioId(e.target.value)} slotProps={{ select: { displayEmpty: true } }}>
              <MenuItem value="" disabled>Seleccione…</MenuItem>
              {(campanas.data ?? []).map((c) => <MenuItem key={c.id} value={String(c.id)}>{c.etiqueta}</MenuItem>)}
            </TextField>
          </Etiqueta>
        </Box>
        <Typography sx={{ fontSize: 13, color: '#6b7280' }}>Al guardar, los productos activos del servicio pasan a inactivos y quedan vigentes solo los de esta lista.</Typography>
        {filas.map((f, i) => (
          <Borrador
            key={i} n={i + 1} fila={f} onCambio={(k, v) => setFilas(filas.map((x, j) => (j === i ? { ...x, [k]: v } : x)))}
            onQuitar={filas.length > 1 ? () => setFilas(filas.filter((_x, j) => j !== i)) : undefined}
          />
        ))}
        <Box>
          <ButtonBase
            onClick={() => setFilas([...filas, { ...FILA_VACIA }])}
            sx={{ height: 44, px: 2.25, border: `1px dashed ${MARCA.azul700}`, borderRadius: '10px', bgcolor: '#f4f7fd', color: MARCA.azul700, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', '&:hover': { bgcolor: '#e8eefb' } }}
          >
            + Agregar otro producto
          </ButtonBase>
        </Box>
        {error && <ErrorForm>{error}</ErrorForm>}
        <AccionesForm>
          <Button variant="outlined" onClick={onVolver} disabled={guardar.isPending}>Regresar</Button>
          <Button type="submit" variant="contained" loading={guardar.isPending}>Guardar</Button>
        </AccionesForm>
      </Box>
    </TarjetaConfig>
  );
}

function FormEditar({ productos, onVolver, onListo }: { productos: Producto[]; onVolver: () => void; onListo: (m: string) => void }) {
  const cache = useQueryClient();
  const [filas, setFilas] = useState<Fila[]>(() => productos.map(filaDe));
  const [error, setError] = useState<string | null>(null);
  const guardar = useMutation({
    mutationFn: () => api.put('/admin/productos', { productos: filas.map((f, i) => ({ id: productos[i]!.id, ...f })) }),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['productos'] });
      onListo('Productos actualizados correctamente.');
    },
    onError: (e) => setError(mensajeDe(e)),
  });
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const v = validar(filas);
    setError(v);
    if (!v) guardar.mutate();
  };
  return (
    <TarjetaConfig>
      <Box component="form" onSubmit={enviar} noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {filas.map((f, i) => (
          <Borrador key={productos[i]!.id} n={i + 1} fila={f} servicio={productos[i]!.servicio.trim()} onCambio={(k, v) => setFilas(filas.map((x, j) => (j === i ? { ...x, [k]: v } : x)))} />
        ))}
        {error && <ErrorForm>{error}</ErrorForm>}
        <AccionesForm>
          <Button variant="outlined" onClick={onVolver} disabled={guardar.isPending}>Regresar</Button>
          <Button type="submit" variant="contained" loading={guardar.isPending}>Actualizar</Button>
        </AccionesForm>
      </Box>
    </TarjetaConfig>
  );
}

function Lista({ productos, onNuevo, onEditar }: { productos: Producto[]; onNuevo: () => void; onEditar: (p: Producto[]) => void }) {
  const [q, setQ] = useState('');
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const termino = q.trim().toLowerCase();
  const visibles = productos.filter((p) => termino === '' || [p.descripcion, p.codigo_producto, p.codplan, p.servicio, p.fecha].join(' ').toLowerCase().includes(termino));
  const todos = visibles.length > 0 && visibles.every((p) => marcados.has(p.id));
  const alternar = (id: number) => {
    const s = new Set(marcados);
    if (!s.delete(id)) s.add(id);
    setMarcados(s);
  };
  const n = marcados.size;

  return (
    <TarjetaConfig>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Buscador valor={q} onCambio={setQ} placeholder="Buscar producto, código, plan…" />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button
            disabled={n === 0} onClick={() => onEditar(productos.filter((p) => marcados.has(p.id)))}
            sx={{ height: 44, px: 2.25, ...(n > 0 ? { bgcolor: MARCA.azul700, color: '#fff', '&:hover': { bgcolor: MARCA.azul900 } } : { bgcolor: '#e4e8f0 !important' }) }}
          >
            Editar seleccionados{n > 0 ? ` (${n})` : ''}
          </Button>
          <Button variant="contained" onClick={onNuevo} sx={{ height: 44, px: 2.25, ...BOTON_DORADO }}>+ Agregar productos</Button>
        </Box>
      </Box>

      <TablaConfig>
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox" sx={{ pl: 1 }}>
              <Checkbox
                size="small" checked={todos} indeterminate={!todos && visibles.some((p) => marcados.has(p.id))} slotProps={{ input: { 'aria-label': 'Seleccionar todos' } }}
                onChange={() => {
                  const s = new Set(marcados);
                  visibles.forEach((p) => (todos ? s.delete(p.id) : s.add(p.id)));
                  setMarcados(s);
                }}
              />
            </TableCell>
            <TableCell>#</TableCell><TableCell>Nombre</TableCell><TableCell>Código</TableCell><TableCell align="right">Costo</TableCell>
            <TableCell>Fecha activación</TableCell><TableCell>Plan</TableCell><TableCell>Servicio</TableCell><TableCell align="center">Editar</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {visibles.map((p, i) => (
            <TableRow key={p.id} selected={marcados.has(p.id)} hover>
              <TableCell padding="checkbox" sx={{ pl: 1 }}><Checkbox size="small" checked={marcados.has(p.id)} onChange={() => alternar(p.id)} slotProps={{ input: { 'aria-label': `Seleccionar ${p.descripcion}` } }} /></TableCell>
              <TableCell sx={{ color: '#6b7280' }}>{i + 1}</TableCell>
              <TableCell sx={{ fontWeight: 500 }}>{p.descripcion}</TableCell>
              <TableCell>{p.codigo_producto}</TableCell>
              <TableCell align="right">{Number(p.costo_prod ?? 0).toFixed(2)}</TableCell>
              <TableCell>{p.fecha}</TableCell>
              <TableCell>{p.codplan}</TableCell>
              <TableCell><PildoraServicio>{p.servicio.trim()}</PildoraServicio></TableCell>
              <TableCell align="center"><BotonIcono titulo={`Editar ${p.descripcion}`} onClick={() => onEditar([p])}><EditIcon /></BotonIcono></TableCell>
            </TableRow>
          ))}
          {visibles.length === 0 && <TableRow><TableCell colSpan={9} align="center" sx={{ py: 3.5 }}>{productos.length === 0 ? 'No hay productos activos.' : 'Sin resultados.'}</TableCell></TableRow>}
        </TableBody>
      </TablaConfig>
      <Typography sx={{ fontSize: 13 }}>Mostrando {visibles.length} de {productos.length} productos activos</Typography>
    </TarjetaConfig>
  );
}

export default function ProductosPage() {
  const productos = useQuery({ queryKey: ['productos'], queryFn: () => api.get<Producto[]>('/admin/productos') });
  const [vista, setVista] = useState<Vista>({ modo: 'lista' });
  const [mensaje, setMensaje] = useState<string | null>(null);
  const volver = () => setVista({ modo: 'lista' });
  const listo = (m: string) => { setMensaje(m); volver(); };

  const hero = vista.modo === 'nuevo'
    ? { miga: 'Configuración / Productos / Nuevo', titulo: 'Nuevo producto', subtitulo: 'Agrega uno o varios productos al servicio elegido.' }
    : vista.modo === 'editar'
      ? { miga: 'Configuración / Productos / Edición', titulo: vista.productos.length > 1 ? `Edición de ${vista.productos.length} productos` : 'Edición de producto', subtitulo: 'Modifica nombre, código, precio y plan. El servicio no se puede cambiar.' }
      : { miga: 'Configuración / Productos', titulo: 'Productos activos', subtitulo: 'Consulta, crea y edita los productos de cada servicio.' };

  return (
    <Pagina {...hero}>
      {mensaje && vista.modo === 'lista' && <Aviso onCerrar={() => setMensaje(null)}>{mensaje}</Aviso>}
      {vista.modo === 'nuevo' && <FormNuevo onVolver={volver} onListo={listo} />}
      {vista.modo === 'editar' && <FormEditar productos={vista.productos} onVolver={volver} onListo={listo} />}
      {vista.modo === 'lista' && (
        <Consulta query={productos}>
          {(lista) => <Lista productos={lista} onNuevo={() => { setMensaje(null); setVista({ modo: 'nuevo' }); }} onEditar={(p) => { setMensaje(null); setVista({ modo: 'editar', productos: p }); }} />}
        </Consulta>
      )}
    </Pagina>
  );
}
