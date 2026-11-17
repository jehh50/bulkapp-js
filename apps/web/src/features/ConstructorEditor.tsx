/**
 * Editor del Constructor: datos generales, campos, vista previa, historial de
 * versiones y base de datos (carga CSV/XLSX) del formulario.
 */
import { useRef, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Checkbox, Chip, FormControlLabel, Grid, IconButton, MenuItem, Radio, Stack,
  Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowDownIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpIcon from '@mui/icons-material/ArrowUpward';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import UploadIcon from '@mui/icons-material/UploadFileOutlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CARGA_MAX_BYTES_FORMULARIO, REGISTRO, TIPOS_CAMPO, slugColumna, validarValores, valorComoTexto, type CampoDef, type ColumnaCarga, type Definicion,
  type TipoCampo, type ValorCampo, type Valores,
} from '@bulkapp/shared';
import { ApiError, api, mensajeDe } from '../shared/api.ts';
import { Tabla } from '../shared/datos.tsx';
import { Confirmacion, Consulta, Pagina, Seccion, Selector, Vacio, fechaHora, numero, useAvisos } from '../shared/ui.tsx';
import { CampoDinamico, camposVisibles } from './CampoDinamico.tsx';

export interface Conflicto { servicio_id: number; servicio: string; formulario_id: number; formulario: string }

export function ListaConflictos({ conflictos }: { conflictos: Conflicto[] }) {
  return (
    <>
      <Typography variant="body2" sx={{ mb: 1 }}>Estas campañas ya tienen un formulario activo. Si continúas, dejarán de usarlo y pasarán a este:</Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {conflictos.map((c) => <li key={`${c.servicio_id}-${c.formulario_id}`}><strong>{c.servicio}</strong> — hoy usa «{c.formulario}»</li>)}
      </Box>
    </>
  );
}

interface Expresion { clave: string; nombre: string; descripcion: string | null; tipos: string; ejemplo_valido: string | null }
interface Catalogos { servicios: Array<{ id: number; descripcion: string; status_id: number }>; expresiones: Expresion[] }
interface BdVigente { id: number; archivo: string; filas: number; fecha: string; busqueda: string | null; columnas: ColumnaCarga[]; muestra: Record<string, unknown> | null }
interface Detalle {
  formulario: { id: number; nombre: string; status_id: number; btn_texto: string; version: number; definicion: Definicion; servicios: number[] };
  bd: BdVigente | null;
}

/** Campo en edición: la definición más un id local estable y textos auxiliares. */
interface CampoEditable {
  uid: number; k: string; kManual: boolean; type: TipoCampo; label: string; placeholder: string; help: string; req: boolean; min: string; max: string;
  expr: string; opts: string; tree: string; lv1: string; lv2: string; condK: string; condV: string;
}

const TIPO_NOMBRE: Record<TipoCampo, string> = {
  text: 'Texto', textarea: 'Texto largo', number: 'Número', date: 'Fecha', email: 'Correo', select: 'Lista de opciones', nested: 'Lista anidada (2 niveles)',
};
let siguienteUid = 1;

const aEditable = (c: CampoDef): CampoEditable => ({
  uid: siguienteUid++, k: c.k, kManual: true, type: c.type, label: c.label, placeholder: c.placeholder ?? '', help: c.help ?? '', req: c.req === true,
  min: c.min === undefined ? '' : String(c.min), max: c.max === undefined ? '' : String(c.max), expr: c.expr ?? '',
  opts: (c.opts ?? []).join('\n'), tree: (c.tree ?? []).map((n) => `${n.p}: ${n.c}`).join('\n'), lv1: c.lv1 ?? '', lv2: c.lv2 ?? '',
  condK: c.cond?.k ?? '', condV: c.cond?.v ?? '',
});

const campoNuevo = (): CampoEditable => ({
  uid: siguienteUid++, k: '', kManual: false, type: 'text', label: '', placeholder: '', help: '', req: false, min: '', max: '', expr: '', opts: '', tree: '',
  lv1: '', lv2: '', condK: '', condV: '',
});

const lineas = (texto: string): string[] => texto.split('\n').map((l) => l.trim()).filter(Boolean);

/** Definición tal como se envía al servidor (que la valida y normaliza de nuevo). */
function aDefinicion(campos: CampoEditable[]): Definicion {
  return {
    campos: campos.map((c) => {
      const d: Record<string, unknown> = { k: c.k, type: c.type, label: c.label.trim() };
      if (c.placeholder) d.placeholder = c.placeholder;
      if (c.help) d.help = c.help;
      if (c.req) d.req = true;
      if (c.min !== '') d.min = c.min;
      if (c.max !== '') d.max = c.max;
      if (c.expr) d.expr = c.expr;
      if (c.type === 'select') d.opts = lineas(c.opts);
      if (c.type === 'nested') {
        d.tree = lineas(c.tree).map((l) => {
          const corte = l.indexOf(':');
          return corte === -1 ? { p: l, c: '' } : { p: l.slice(0, corte).trim(), c: l.slice(corte + 1).trim() };
        });
        if (c.lv1) d.lv1 = c.lv1;
        if (c.lv2) d.lv2 = c.lv2;
      }
      if (c.condK) d.cond = { k: c.condK, v: c.condV };
      return d as unknown as CampoDef;
    }),
  };
}

// --- Editor de un campo ---------------------------------------------------------------

function EditorCampo({ campo: c, posicion, total, previos, expresiones, onChange, onMover, onQuitar }: {
  campo: CampoEditable; posicion: number; total: number; previos: CampoEditable[]; expresiones: Expresion[];
  onChange: (cambios: Partial<CampoEditable>) => void; onMover: (delta: -1 | 1) => void; onQuitar: () => void;
}) {
  const aplicables = expresiones.filter((e) => e.tipos.split(',').map((t) => t.trim()).includes(c.type));
  const conLimites = c.type === 'text' || c.type === 'textarea' || c.type === 'number';
  const expresion = aplicables.find((e) => e.clave === c.expr);
  const detener = (e: { stopPropagation: () => void }) => e.stopPropagation();

  return (
    <Accordion variant="outlined" disableGutters defaultExpanded={c.label === ''} slotProps={{ transition: { unmountOnExit: true } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flex: 1, minWidth: 0, pr: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ width: 24 }}>{posicion + 1}</Typography>
          <Typography sx={{ fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label || 'Campo sin etiqueta'}</Typography>
          <Chip size="small" label={TIPO_NOMBRE[c.type]} variant="outlined" sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />
          {c.req && <Chip size="small" label="Obligatorio" color="secondary" />}
          <Box onClick={detener} sx={{ display: 'flex' }}>
            <Tooltip title="Subir"><span><IconButton component="span" size="small" aria-label="Subir campo" disabled={posicion === 0} onClick={() => onMover(-1)}><ArrowUpIcon fontSize="small" /></IconButton></span></Tooltip>
            <Tooltip title="Bajar"><span><IconButton component="span" size="small" aria-label="Bajar campo" disabled={posicion === total - 1} onClick={() => onMover(1)}><ArrowDownIcon fontSize="small" /></IconButton></span></Tooltip>
            <Tooltip title="Quitar"><IconButton component="span" size="small" color="error" aria-label="Quitar campo" onClick={onQuitar}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
          </Box>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField
              label="Etiqueta" required fullWidth value={c.label} slotProps={{ htmlInput: { maxLength: 120 } }}
              onChange={(e) => onChange({ label: e.target.value, ...(c.kManual ? {} : { k: slugColumna(e.target.value) }) })}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField
              label="Clave" required fullWidth value={c.k} helperText="Nombre interno de la columna (minúsculas, números y _)."
              onChange={(e) => onChange({ k: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''), kManual: true })} slotProps={{ htmlInput: { maxLength: 40 } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Selector
              label="Tipo" value={c.type} opciones={TIPOS_CAMPO.map((t) => ({ value: t, label: TIPO_NOMBRE[t] }))}
              onChange={(e) => onChange({ type: e.target.value as TipoCampo, expr: '' })}
            />
          </Grid>

          {c.type !== 'select' && c.type !== 'nested' && c.type !== 'date' && (
            <Grid size={{ xs: 12, sm: 6, md: 4 }}><TextField label="Texto de ejemplo (placeholder)" fullWidth value={c.placeholder} onChange={(e) => onChange({ placeholder: e.target.value })} /></Grid>
          )}
          <Grid size={{ xs: 12, sm: 6, md: 4 }}><TextField label="Texto de ayuda" fullWidth value={c.help} onChange={(e) => onChange({ help: e.target.value })} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <FormControlLabel control={<Checkbox checked={c.req} onChange={(_e, req) => onChange({ req })} />} label="Obligatorio" />
          </Grid>

          {conLimites && (
            <>
              <Grid size={{ xs: 6, md: 2 }}><TextField label={c.type === 'number' ? 'Mínimo' : 'Mín. caracteres'} type="number" fullWidth value={c.min} onChange={(e) => onChange({ min: e.target.value })} /></Grid>
              <Grid size={{ xs: 6, md: 2 }}><TextField label={c.type === 'number' ? 'Máximo' : 'Máx. caracteres'} type="number" fullWidth value={c.max} onChange={(e) => onChange({ max: e.target.value })} /></Grid>
            </>
          )}
          {aplicables.length > 0 && (
            <Grid size={{ xs: 12, md: 8 }}>
              <Selector
                label="Validación" value={c.expr} vacio="Ninguna" opciones={aplicables.map((e) => ({ value: e.clave, label: e.nombre }))}
                onChange={(e) => onChange({ expr: e.target.value })}
                helperText={expresion ? `${expresion.descripcion ?? ''}${expresion.ejemplo_valido ? ` Ejemplo: ${expresion.ejemplo_valido}` : ''}` : undefined}
              />
            </Grid>
          )}

          {c.type === 'select' && (
            <Grid size={12}><TextField label="Opciones (una por línea)" required fullWidth multiline minRows={3} value={c.opts} onChange={(e) => onChange({ opts: e.target.value })} /></Grid>
          )}
          {c.type === 'nested' && (
            <>
              <Grid size={{ xs: 12, sm: 6 }}><TextField label="Etiqueta del nivel 1" fullWidth value={c.lv1} onChange={(e) => onChange({ lv1: e.target.value })} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField label="Etiqueta del nivel 2" fullWidth value={c.lv2} onChange={(e) => onChange({ lv2: e.target.value })} /></Grid>
              <Grid size={12}>
                <TextField
                  label="Opciones anidadas" required fullWidth multiline minRows={3} value={c.tree} onChange={(e) => onChange({ tree: e.target.value })}
                  helperText="Una línea por opción del nivel 1, con sus hijos separados por coma. Ejemplo: Interesado: Agenda visita, Pide información"
                />
              </Grid>
            </>
          )}

          {previos.length > 0 && (
            <>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Selector
                  label="Mostrar solo si el campo…" value={previos.some((p) => p.k === c.condK) ? c.condK : ''} vacio="Siempre visible"
                  opciones={previos.filter((p) => p.k !== '').map((p) => ({ value: p.k, label: p.label || p.k }))}
                  onChange={(e) => onChange({ condK: e.target.value, condV: '' })}
                />
              </Grid>
              {c.condK !== '' && (
                <Grid size={{ xs: 12, sm: 6 }}><TextField label="…tiene el valor" fullWidth value={c.condV} onChange={(e) => onChange({ condV: e.target.value })} helperText="En listas anidadas se compara el nivel 1." /></Grid>
              )}
            </>
          )}
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
}

// --- Vista previa -----------------------------------------------------------------------

function VistaPrevia({ definicion, boton }: { definicion: Definicion; boton: string }) {
  const [valores, setValores] = useState<Valores>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [ok, setOk] = useState(false);
  const cambiar = (k: string, v: ValorCampo) => {
    setValores({ ...valores, [k]: v });
    setOk(false);
  };
  const probar = () => {
    const r = validarValores(definicion, valores);
    setErrores(r.errores);
    setOk(r.ok);
  };
  if (definicion.campos.length === 0) return <Vacio>Agrega campos en «Diseño» para ver la vista previa.</Vacio>;
  return (
    <Stack spacing={2.5} sx={{ maxWidth: 720 }}>
      <Alert severity="info">Así verá el formulario el operador. Los datos de esta prueba no se guardan.</Alert>
      {camposVisibles(definicion, valores).map((c) => (
        <CampoDinamico key={c.k || c.label} campo={c} valor={valores[c.k]} error={errores[c.k]} onChange={(v) => cambiar(c.k, v)} />
      ))}
      {ok && <Alert severity="success">Los valores pasan la validación.</Alert>}
      <Button variant="contained" onClick={probar} sx={{ alignSelf: 'flex-start' }}>{boton || 'Guardar'}</Button>
    </Stack>
  );
}

// --- Historial de versiones ----------------------------------------------------------------

interface Version { id: number; version: number; nota: string | null; vigente: boolean; fecha: string }

function Historial({ formId, onCambio }: { formId: number; onCambio: () => void }) {
  const avisos = useAvisos();
  const versiones = useQuery({ queryKey: ['constructor', 'historial', formId], queryFn: () => api.get<Version[]>(`/constructor/formularios/${formId}/historial`) });
  const [aRestaurar, setARestaurar] = useState<Version | null>(null);
  const restaurar = useMutation({
    mutationFn: (v: Version) => api.post(`/constructor/formularios/${formId}/versiones/${v.id}/vigente`),
    onSuccess: (_r, v) => {
      avisos.ok(`La versión v${v.version} vuelve a ser la vigente.`);
      setARestaurar(null);
      onCambio();
    },
    onError: (e) => avisos.error(e),
  });
  return (
    <>
      <Consulta query={versiones}>
        {(lista) => (
          <Tabla
            filas={lista} clave={(v) => v.id} vacio="Aún no hay versiones."
            columnas={[
              { titulo: 'Versión', celda: (v) => <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><span>v{v.version}</span>{v.vigente && <Chip size="small" color="success" label="Vigente" />}</Stack> },
              { titulo: 'Fecha', celda: (v) => fechaHora(v.fecha) },
              { titulo: 'Nota', celda: (v) => v.nota ?? '—' },
              { titulo: '', celda: (v) => (v.vigente ? null : <Button size="small" onClick={() => setARestaurar(v)}>Usar esta versión</Button>) },
            ]}
          />
        )}
      </Consulta>
      <Confirmacion
        abierto={aRestaurar !== null} titulo="Cambiar la versión vigente" confirmar="Usar esta versión" ocupado={restaurar.isPending}
        texto={<>Los operadores capturarán con la versión <strong>v{aRestaurar?.version}</strong>. Los registros ya guardados no cambian.</>}
        onCerrar={() => setARestaurar(null)} onConfirmar={() => aRestaurar && restaurar.mutate(aRestaurar)}
      />
    </>
  );
}

// --- Base de datos del formulario ------------------------------------------------------------

interface Analisis { headers: string[]; filas_total: number; muestra: string[][] }
interface Carga { id: number; archivo: string; filas: number; vigente: boolean; fecha: string }

function BaseDatos({ formId, onCambio }: { formId: number; onCambio: () => void }) {
  const avisos = useAvisos();
  const cache = useQueryClient();
  const entrada = useRef<HTMLInputElement>(null);
  const cargas = useQuery({ queryKey: ['constructor', 'cargas', formId], queryFn: () => api.get<{ cargas: Carga[]; vigente: BdVigente | null }>(`/constructor/formularios/${formId}/cargas`) });
  const [archivo, setArchivo] = useState<File | null>(null);
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [elegidas, setElegidas] = useState<Record<string, string>>({});
  const [busqueda, setBusqueda] = useState('');

  const reiniciar = () => {
    setArchivo(null);
    setAnalisis(null);
    setElegidas({});
    setBusqueda('');
    if (entrada.current) entrada.current.value = '';
  };
  const refrescar = () => {
    void cache.invalidateQueries({ queryKey: ['constructor', 'cargas', formId] });
    onCambio();
  };

  const analizar = useMutation({
    mutationFn: (f: File) => {
      const datos = new FormData();
      datos.set('archivo', f);
      return api.post<Analisis>('/constructor/cargas/analizar', datos);
    },
    onSuccess: (r) => {
      setAnalisis(r);
      setElegidas(Object.fromEntries(r.headers.map((h) => [h, h])));
      setBusqueda(r.headers[0] ?? '');
    },
    onError: (e) => {
      avisos.error(e);
      reiniciar();
    },
  });
  const confirmar = useMutation({
    mutationFn: () => {
      const datos = new FormData();
      if (archivo) datos.set('archivo', archivo);
      datos.set('columnas', JSON.stringify({ busqueda, columnas: (analisis?.headers ?? []).filter((h) => h in elegidas).map((h) => ({ col: h, label: elegidas[h] })) }));
      return api.post<{ filas: number; omitidas: number }>(`/constructor/formularios/${formId}/cargas`, datos);
    },
    onSuccess: (r) => {
      avisos.ok(`Base de datos cargada: ${numero(r.filas)} filas${r.omitidas > 0 ? ` (${numero(r.omitidas)} omitidas sin dato de búsqueda)` : ''}.`);
      reiniciar();
      refrescar();
    },
    onError: (e) => avisos.error(e),
  });
  const vigente = useMutation({
    mutationFn: (c: Carga) => api.post(`/constructor/formularios/${formId}/cargas/${c.id}/vigente`),
    onSuccess: () => {
      avisos.ok('Carga marcada como vigente.');
      refrescar();
    },
    onError: (e) => avisos.error(e),
  });

  const elegir = (f: File | null) => {
    if (!f) return;
    if (f.size > CARGA_MAX_BYTES_FORMULARIO) {
      avisos.error('El archivo supera el tamaño máximo (20 MB).');
      return;
    }
    setArchivo(f);
    analizar.mutate(f);
  };

  return (
    <Stack spacing={3}>
      <Alert severity="info">
        Con base de datos, el operador busca primero un registro (por la columna de búsqueda), ve sus datos y completa el formulario. Cada registro admite una sola gestión.
      </Alert>

      <Consulta query={cargas}>
        {(r) => (
          <>
            {r.vigente && (
              <Seccion titulo="Base de datos vigente">
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>{r.vigente.archivo}</strong> · {numero(r.vigente.filas)} filas · cargada el {fechaHora(r.vigente.fecha)}
                </Typography>
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                  {r.vigente.columnas.map((c) => (
                    <Chip key={c.k} size="small" label={`${c.label}${r.vigente?.muestra ? `: ${valorComoTexto(r.vigente.muestra[c.k]) || '—'}` : ''}`} color={c.k === r.vigente?.busqueda ? 'primary' : 'default'} variant={c.k === r.vigente?.busqueda ? 'filled' : 'outlined'} />
                  ))}
                </Stack>
                <Typography variant="caption" color="text.secondary">La columna resaltada es la de búsqueda. Los valores son de la primera fila.</Typography>
              </Seccion>
            )}

            <Seccion titulo={r.vigente ? 'Reemplazar la base de datos' : 'Cargar una base de datos'}>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: analisis ? 2 : 0 }}>
                <Button component="label" variant="outlined" startIcon={<UploadIcon />} loading={analizar.isPending}>
                  Elegir archivo (CSV o XLSX)
                  <input ref={entrada} type="file" hidden accept=".csv,.txt,.xlsx" onChange={(e) => elegir(e.target.files?.[0] ?? null)} />
                </Button>
                {archivo && <Typography variant="body2">{archivo.name}{analisis ? ` · ${numero(analisis.filas_total)} filas` : ''}</Typography>}
                {archivo && <Button onClick={reiniciar} disabled={confirmar.isPending}>Cancelar</Button>}
              </Stack>

              {analisis && (
                <Stack spacing={2}>
                  <Typography variant="body2" color="text.secondary">Elige las columnas que verá el operador, su etiqueta y cuál se usa para buscar.</Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow><TableCell padding="checkbox">Usar</TableCell><TableCell>Columna del archivo</TableCell><TableCell>Etiqueta</TableCell><TableCell>Ejemplo</TableCell><TableCell align="center">Búsqueda</TableCell></TableRow>
                      </TableHead>
                      <TableBody>
                        {analisis.headers.map((h, i) => {
                          const usada = h in elegidas;
                          return (
                            <TableRow key={h}>
                              <TableCell padding="checkbox">
                                <Checkbox
                                  size="small" checked={usada} slotProps={{ input: { 'aria-label': `Usar la columna ${h}` } }}
                                  onChange={(_e, marcar) => {
                                    const { [h]: _quitada, ...resto } = elegidas;
                                    setElegidas(marcar ? { ...elegidas, [h]: h } : resto);
                                    if (!marcar && busqueda === h) setBusqueda('');
                                  }}
                                />
                              </TableCell>
                              <TableCell>{h}</TableCell>
                              <TableCell sx={{ py: 0.5 }}>
                                <TextField variant="standard" fullWidth disabled={!usada} value={elegidas[h] ?? ''} onChange={(e) => setElegidas({ ...elegidas, [h]: e.target.value })} slotProps={{ htmlInput: { maxLength: 80, 'aria-label': `Etiqueta de ${h}` } }} />
                              </TableCell>
                              <TableCell sx={{ color: 'text.secondary', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{analisis.muestra[0]?.[i] ?? ''}</TableCell>
                              <TableCell align="center">
                                <Radio size="small" checked={busqueda === h} disabled={!usada} onChange={() => setBusqueda(h)} slotProps={{ input: { 'aria-label': `Buscar por ${h}` } }} />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <Button variant="contained" sx={{ alignSelf: 'flex-start' }} disabled={busqueda === '' || Object.keys(elegidas).length === 0} loading={confirmar.isPending} onClick={() => confirmar.mutate()}>
                    Cargar {numero(analisis.filas_total)} filas
                  </Button>
                </Stack>
              )}
            </Seccion>

            {r.cargas.length > 0 && (
              <Seccion titulo="Cargas anteriores">
                <Tabla
                  filas={r.cargas} clave={(c) => c.id}
                  columnas={[
                    { titulo: 'Archivo', celda: (c) => c.archivo },
                    { titulo: 'Filas', numerica: true, celda: (c) => numero(c.filas) },
                    { titulo: 'Fecha', celda: (c) => fechaHora(c.fecha) },
                    { titulo: '', celda: (c) => (c.vigente ? <Chip size="small" color="success" label="Vigente" /> : <Button size="small" disabled={vigente.isPending} onClick={() => vigente.mutate(c)}>Marcar vigente</Button>) },
                  ]}
                />
              </Seccion>
            )}
          </>
        )}
      </Consulta>
    </Stack>
  );
}

// --- Editor ------------------------------------------------------------------------------------

type Pestana = 'diseno' | 'previa' | 'bd' | 'historial';

function Editor({ detalle, catalogos, onVolver, onCreado, onRecargar }: {
  detalle: Detalle | null; catalogos: Catalogos; onVolver: () => void; onCreado: (id: number) => void; onRecargar: () => void;
}) {
  const avisos = useAvisos();
  const form = detalle?.formulario ?? null;
  const [pestana, setPestana] = useState<Pestana>('diseno');
  const [nombre, setNombre] = useState(form?.nombre ?? '');
  const [boton, setBoton] = useState(form?.btn_texto ?? 'Guardar');
  const [activo, setActivo] = useState(form?.status_id === REGISTRO.ACTIVO);
  const [servicios, setServicios] = useState<number[]>(form?.servicios ?? []);
  const [nota, setNota] = useState('');
  const [campos, setCampos] = useState<CampoEditable[]>(() => (form ? form.definicion.campos.map(aEditable) : [campoNuevo()]));
  const [errores, setErrores] = useState<string[]>([]);
  const [conflictos, setConflictos] = useState<Conflicto[] | null>(null);

  const guardar = useMutation({
    mutationFn: (reasignar: boolean) => {
      const cuerpo = { nombre, status_id: activo ? REGISTRO.ACTIVO : REGISTRO.INACTIVO, btn_texto: boton, servicios, nota, reasignar, definicion: aDefinicion(campos) };
      return form ? api.put<{ id: number; version: number }>(`/constructor/formularios/${form.id}`, cuerpo) : api.post<{ id: number; version: number }>('/constructor/formularios', cuerpo);
    },
    onSuccess: (r) => {
      avisos.ok(`Formulario guardado (versión v${r.version}).`);
      setErrores([]);
      setConflictos(null);
      setNota('');
      if (form) onRecargar();
      else onCreado(r.id);
    },
    onError: (e) => {
      setConflictos(null);
      if (e instanceof ApiError && e.code === 'conflicto') setConflictos((e.datos.conflictos as Conflicto[] | undefined) ?? []);
      else {
        setErrores(e instanceof ApiError && Array.isArray(e.errores) ? e.errores : []);
        setPestana('diseno');
        avisos.error(e);
      }
    },
  });

  const cambiarCampo = (uid: number, cambios: Partial<CampoEditable>) => setCampos(campos.map((c) => (c.uid === uid ? { ...c, ...cambios } : c)));
  const mover = (i: number, delta: -1 | 1) => {
    const copia = [...campos];
    const [quitado] = copia.splice(i, 1);
    if (quitado) copia.splice(i + delta, 0, quitado);
    setCampos(copia);
  };

  return (
    <Pagina
      titulo={form ? form.nombre : 'Nuevo formulario'} subtitulo={form ? `Versión vigente v${form.version}. Cada guardado crea una versión nueva.` : 'Define los campos y asígnalo a una o más campañas.'}
      acciones={(
        <>
          <Button startIcon={<ArrowBackIcon />} onClick={onVolver}>Formularios</Button>
          <Button variant="contained" loading={guardar.isPending} disabled={nombre.trim() === ''} onClick={() => guardar.mutate(false)}>Guardar</Button>
        </>
      )}
    >
      <Tabs value={pestana} onChange={(_e, v: Pestana) => setPestana(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }} variant="scrollable">
        <Tab value="diseno" label="Diseño" />
        <Tab value="previa" label="Vista previa" />
        {form && <Tab value="bd" label="Base de datos" />}
        {form && <Tab value="historial" label="Historial" />}
      </Tabs>

      {pestana === 'diseno' && (
        <Stack spacing={3}>
          {errores.length > 0 && (
            <Alert severity="error">
              <Box component="ul" sx={{ m: 0, pl: 2 }}>{errores.map((e) => <li key={e}>{e}</li>)}</Box>
            </Alert>
          )}
          <Seccion titulo="Datos generales">
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 5 }}><TextField label="Nombre del formulario" required fullWidth value={nombre} onChange={(e) => setNombre(e.target.value)} slotProps={{ htmlInput: { maxLength: 150 } }} /></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}><TextField label="Texto del botón" fullWidth value={boton} onChange={(e) => setBoton(e.target.value)} slotProps={{ htmlInput: { maxLength: 80 } }} /></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <FormControlLabel control={<Checkbox checked={activo} onChange={(_e, v) => setActivo(v)} />} label="Activo (disponible para los operadores)" />
              </Grid>
              <Grid size={{ xs: 12, md: 7 }}>
                <TextField
                  select fullWidth label="Campañas que lo usan" value={servicios} helperText="Solo campañas de flujo dinámico."
                  onChange={(e) => setServicios((Array.isArray(e.target.value) ? e.target.value : []).map(Number))}
                  slotProps={{ select: { multiple: true, renderValue: (v) => catalogos.servicios.filter((s) => (v as number[]).includes(s.id)).map((s) => s.descripcion).join(', ') } }}
                >
                  {catalogos.servicios.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      <Checkbox size="small" checked={servicios.includes(s.id)} sx={{ py: 0 }} />
                      {s.descripcion}{s.status_id !== REGISTRO.ACTIVO ? ' (inactiva)' : ''}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 5 }}><TextField label="Nota de esta versión" fullWidth value={nota} onChange={(e) => setNota(e.target.value)} helperText="Opcional: qué cambió." slotProps={{ htmlInput: { maxLength: 255 } }} /></Grid>
            </Grid>
          </Seccion>

          <Seccion titulo={`Campos (${campos.length})`} acciones={<Button startIcon={<AddIcon />} onClick={() => setCampos([...campos, campoNuevo()])}>Agregar campo</Button>}>
            {campos.length === 0 ? <Vacio>El formulario necesita al menos un campo.</Vacio> : (
              <Stack spacing={1}>
                {campos.map((c, i) => (
                  <EditorCampo
                    key={c.uid} campo={c} posicion={i} total={campos.length} previos={campos.slice(0, i)} expresiones={catalogos.expresiones}
                    onChange={(cambios) => cambiarCampo(c.uid, cambios)} onMover={(delta) => mover(i, delta)} onQuitar={() => setCampos(campos.filter((x) => x.uid !== c.uid))}
                  />
                ))}
              </Stack>
            )}
          </Seccion>
        </Stack>
      )}

      {pestana === 'previa' && <Seccion><VistaPrevia key={JSON.stringify(aDefinicion(campos))} definicion={aDefinicion(campos)} boton={boton} /></Seccion>}
      {pestana === 'bd' && form && <BaseDatos formId={form.id} onCambio={onRecargar} />}
      {pestana === 'historial' && form && <Seccion><Historial formId={form.id} onCambio={onRecargar} /></Seccion>}

      <Confirmacion
        abierto={conflictos !== null} titulo="Campañas con otro formulario activo" confirmar="Reasignar y guardar" ocupado={guardar.isPending}
        texto={<ListaConflictos conflictos={conflictos ?? []} />} onCerrar={() => setConflictos(null)} onConfirmar={() => guardar.mutate(true)}
      />
    </Pagina>
  );
}

export function EditorFormulario({ id, onVolver, onCreado }: { id: number | null; onVolver: () => void; onCreado: (id: number) => void }) {
  const cache = useQueryClient();
  const catalogos = useQuery({ queryKey: ['constructor', 'catalogos'], queryFn: () => api.get<Catalogos>('/constructor/catalogos') });
  const detalle = useQuery({ queryKey: ['constructor', 'formulario', id], enabled: id !== null, queryFn: () => api.get<Detalle>(`/constructor/formularios/${id}`) });
  const recargar = () => {
    void cache.invalidateQueries({ queryKey: ['constructor', 'formulario', id] });
    void cache.invalidateQueries({ queryKey: ['constructor', 'historial', id] });
  };

  if (catalogos.error || detalle.error) {
    return (
      <Pagina titulo="Constructor de formularios" acciones={<Button startIcon={<ArrowBackIcon />} onClick={onVolver}>Formularios</Button>}>
        <Alert severity="error">{mensajeDe(catalogos.error ?? detalle.error)}</Alert>
      </Pagina>
    );
  }
  return (
    <Consulta query={catalogos}>
      {(c) => (id === null
        ? <Editor detalle={null} catalogos={c} onVolver={onVolver} onCreado={onCreado} onRecargar={recargar} />
        : (
          <Consulta query={detalle}>
            {/* La clave por versión reinicia el editor con lo guardado (o con la versión restaurada). */}
            {(d) => <Editor key={d.formulario.version} detalle={d} catalogos={c} onVolver={onVolver} onCreado={onCreado} onRecargar={recargar} />}
          </Consulta>
        ))}
    </Consulta>
  );
}
