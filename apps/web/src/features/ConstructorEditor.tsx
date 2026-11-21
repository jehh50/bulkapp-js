/**
 * Editor del Constructor con el mismo flujo que el PHP (`views/constructor` +
 * `public/js/constructor.js`): cabecera (nombre, botón, estado, versiones) y un
 * asistente de 3 pasos — 1 Lienzo (paleta | lienzo | propiedades), 2 Servicio,
 * 3 Base de datos — con «Anterior / Siguiente / Finalizar».
 *
 * El paso 3 necesita el formulario guardado, así que se guarda al salir del paso 2.
 * Cada guardado crea una versión: solo se guarda si el contenido cambió.
 */
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import {
  Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Grid, IconButton, InputAdornment, InputLabel,
  List, ListItem, ListItemText, MenuItem, Paper, Radio, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip,
  Typography,
} from '@mui/material';
import CalculateIcon from '@mui/icons-material/CalculateOutlined';
import CalendarIcon from '@mui/icons-material/CalendarMonthOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import DragIcon from '@mui/icons-material/DragIndicator';
import EmailIcon from '@mui/icons-material/AlternateEmailOutlined';
import HistoryIcon from '@mui/icons-material/HistoryOutlined';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import ListIcon from '@mui/icons-material/ListOutlined';
import NestedIcon from '@mui/icons-material/AccountTreeOutlined';
import NotesIcon from '@mui/icons-material/NotesOutlined';
import SearchIcon from '@mui/icons-material/Search';
import TextIcon from '@mui/icons-material/TextFieldsOutlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CARGA_MAX_BYTES_FORMULARIO, REGISTRO, TIPOS_CAMPO, indexarExpresiones, validarDefinicion, validarValores, valorComoTexto, type CampoDef,
  type ColumnaCarga, type Definicion, type TipoCampo, type ValorCampo, type Valores,
} from '@bulkapp/shared';
import { ApiError, api, mensajeDe } from '../shared/api.ts';
import { MARCA, SOMBRA } from '../shared/tema.ts';
import { Confirmacion, Consulta, Pagina, fechaHora, useAvisos } from '../shared/ui.tsx';
import { CampoDinamico, camposVisibles } from './CampoDinamico.tsx';

// --- Tipos y catálogos ------------------------------------------------------------------

export interface Conflicto { servicio_id: number; servicio: string; formulario_id: number; formulario: string }
export interface Expresion {
  clave: string; nombre: string; descripcion: string | null; patron: string | null; transformacion: string | null; tipos: string;
  ejemplo_valido: string | null; ejemplo_invalido: string | null;
}
export interface Catalogos { servicios: Array<{ id: number; descripcion: string; status_id: number }>; expresiones: Expresion[] }
export interface BdVigente {
  id: number; archivo: string; filas: number; fecha: string; busqueda: string | null; columnas: ColumnaCarga[]; muestra: Record<string, unknown> | null;
}
export interface Detalle {
  formulario: { id: number; nombre: string; status_id: number; btn_texto: string; version: number; definicion: Definicion; servicios: number[] };
  bd: BdVigente | null;
}

/** Mismas etiquetas e íconos que la paleta PHP. */
export const TIPOS: Record<TipoCampo, { label: string; icono: ReactNode }> = {
  text: { label: 'Texto', icono: <TextIcon fontSize="small" /> },
  textarea: { label: 'Área de texto', icono: <NotesIcon fontSize="small" /> },
  number: { label: 'Número', icono: <CalculateIcon fontSize="small" /> },
  date: { label: 'Fecha', icono: <CalendarIcon fontSize="small" /> },
  email: { label: 'Correo', icono: <EmailIcon fontSize="small" /> },
  select: { label: 'Lista (select)', icono: <ListIcon fontSize="small" /> },
  nested: { label: 'Anidado (2 niveles)', icono: <NestedIcon fontSize="small" /> },
};

const tiposDe = (e: Expresion): string[] => e.tipos.split(',').map((t) => t.trim()).filter(Boolean);

export function ListaConflictos({ conflictos }: { conflictos: Conflicto[] }) {
  return (
    <>
      <Typography variant="body2" sx={{ mb: 1 }}>Estos servicios ya tienen un formulario activo:</Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {conflictos.map((c) => <li key={`${c.servicio_id}-${c.formulario_id}`}>{c.servicio} — ocupado por «{c.formulario}»</li>)}
      </Box>
    </>
  );
}

/** Estado del formulario como píldora (`.cns-estado`). */
export function PildoraEstado({ activo, texto }: { activo: boolean; texto?: string }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block', fontSize: 11.5, fontWeight: 600, borderRadius: '20px', px: 1.25, py: 0.25,
        bgcolor: activo ? '#e6f4ea' : '#f1f3f7', color: activo ? '#1e7e40' : '#6b7280',
      }}
    >
      {texto ?? (activo ? 'Activo' : 'Inactivo')}
    </Box>
  );
}

/** Columna blanca del editor (`.cns-col`) con su título en mayúsculas azul. */
function Columna({ titulo, children, sx }: { titulo?: string; children: ReactNode; sx?: object }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: '14px', ...sx }}>
      {titulo && <Typography sx={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', color: MARCA.azul700, mb: 1.5 }}>{titulo}</Typography>}
      {children}
    </Paper>
  );
}

// --- Campos en edición -----------------------------------------------------------------------

/** Campo del lienzo: la definición con un id local; opciones y árbol como texto (como en el PHP). */
interface CampoEditable {
  uid: number; k: string; type: TipoCampo; label: string; placeholder: string; help: string; req: boolean; min: string; max: string;
  expr: string; opts: string; tree: string; lv1: string; lv2: string; condK: string; condV: string;
}

let siguienteUid = 1;

const aEditable = (c: CampoDef): CampoEditable => ({
  uid: siguienteUid++, k: c.k, type: c.type, label: c.label, placeholder: c.placeholder ?? '', help: c.help ?? '', req: c.req === true,
  min: c.min === undefined ? '' : String(c.min), max: c.max === undefined ? '' : String(c.max), expr: c.expr ?? '',
  opts: (c.opts ?? []).join('\n'), tree: (c.tree ?? []).map((n) => `${n.p}: ${n.c}`).join('\n'), lv1: c.lv1 ?? '', lv2: c.lv2 ?? '',
  condK: c.cond?.k ?? '', condV: c.cond?.v ?? '',
});

/** Clave libre `tipo_n` (anidado_n para los anidados), como `siguienteK()` del PHP. */
function siguienteClave(tipo: TipoCampo, campos: CampoEditable[]): string {
  const base = tipo === 'nested' ? 'anidado' : tipo;
  const usadas = new Set(campos.map((c) => c.k));
  let n = 1;
  while (usadas.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

function campoNuevo(tipo: TipoCampo, campos: CampoEditable[]): CampoEditable {
  return {
    uid: siguienteUid++, k: siguienteClave(tipo, campos), type: tipo, label: TIPOS[tipo].label, placeholder: '', help: '', req: false, min: '', max: '',
    expr: '', opts: '', tree: '', lv1: tipo === 'nested' ? 'Nivel 1' : '', lv2: tipo === 'nested' ? 'Nivel 2' : '', condK: '', condV: '',
  };
}

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

// --- Paso 1: paleta, lienzo y propiedades ----------------------------------------------------------

const MIME_TIPO = 'application/x-bulkapp-tipo';
const MIME_CAMPO = 'application/x-bulkapp-campo';

function Paleta({ onAgregar }: { onAgregar: (tipo: TipoCampo) => void }) {
  return (
    <Columna titulo="Paleta">
      <Stack spacing={1}>
        {TIPOS_CAMPO.map((t) => (
          <Box
            key={t} component="button" type="button" draggable
            onClick={() => onAgregar(t)}
            onDragStart={(e: DragEvent) => { e.dataTransfer.setData(MIME_TIPO, t); e.dataTransfer.effectAllowed = 'copy'; }}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1, width: '100%', border: '1px dashed #c9d2e3', borderRadius: '10px', bgcolor: '#f7f9fc',
              px: 1.5, py: 1.1, fontFamily: 'inherit', fontSize: 13, fontWeight: 500, color: '#27324a', cursor: 'grab', textAlign: 'left',
              '&:hover, &:focus-visible': { borderColor: MARCA.dorado, bgcolor: '#fff7e6' },
            }}
          >
            {TIPOS[t].icono}{TIPOS[t].label}
          </Box>
        ))}
      </Stack>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1 }}>Arrastra al lienzo o haz clic para agregar.</Typography>
    </Columna>
  );
}

function Etiquetas({ c, expresiones }: { c: CampoEditable; expresiones: Expresion[] }) {
  const tag = (t: string) => <Box component="span" key={t} sx={{ display: 'inline-block', bgcolor: '#eef2fb', color: '#27324a', borderRadius: '6px', px: 0.75, mr: 0.5 }}>{t}</Box>;
  const expr = expresiones.find((e) => e.clave === c.expr);
  return (
    <Typography component="div" sx={{ fontSize: 11.5, color: 'text.secondary' }}>
      {tag(TIPOS[c.type].label)}
      {c.req && tag('obligatorio')}
      {c.condK && tag('condicional')}
      {expr && tag(expr.nombre)}
      {' · '}<code>{c.k}</code>
    </Typography>
  );
}

/** Lienzo con arrastrar y soltar nativo: recibe tipos de la paleta y reordena campos. */
function Lienzo({ campos, seleccion, expresiones, onSeleccionar, onQuitar, onSoltarTipo, onMover }: {
  campos: CampoEditable[]; seleccion: number | null; expresiones: Expresion[];
  onSeleccionar: (uid: number) => void; onQuitar: (uid: number) => void; onSoltarTipo: (tipo: TipoCampo, indice: number) => void; onMover: (uid: number, indice: number) => void;
}) {
  const [hueco, setHueco] = useState<number | null>(null);

  const indiceSobre = (e: DragEvent<HTMLElement>, i: number) => {
    const caja = e.currentTarget.getBoundingClientRect();
    return e.clientY < caja.top + caja.height / 2 ? i : i + 1;
  };
  const aceptar = (e: DragEvent) => e.dataTransfer.types.includes(MIME_TIPO) || e.dataTransfer.types.includes(MIME_CAMPO);
  const soltar = (e: DragEvent, indice: number) => {
    e.preventDefault();
    setHueco(null);
    const tipo = e.dataTransfer.getData(MIME_TIPO) as TipoCampo;
    if ((TIPOS_CAMPO as readonly string[]).includes(tipo)) { onSoltarTipo(tipo, indice); return; }
    const uid = Number(e.dataTransfer.getData(MIME_CAMPO));
    if (uid) onMover(uid, indice);
  };
  const marcador = <Box sx={{ border: `2px dashed ${MARCA.dorado}`, borderRadius: '10px', bgcolor: '#fff7e6', height: 46, mb: 1 }} />;

  return (
    <Columna titulo="Lienzo">
      <Box
        onDragOver={(e) => { if (aceptar(e)) { e.preventDefault(); if (campos.length === 0 || hueco === null) setHueco(campos.length); } }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHueco(null); }}
        onDrop={(e) => soltar(e, hueco ?? campos.length)}
        sx={{ maxHeight: 'calc(100vh - 340px)', minHeight: 260, overflowY: 'auto', overscrollBehavior: 'contain', pr: 0.5 }}
      >
        {campos.length === 0 && hueco === null && (
          <Box sx={{ border: '2px dashed #d5dcec', borderRadius: '12px', color: 'text.secondary', textAlign: 'center', py: 4.5, px: 2, fontSize: 14 }}>
            Sin campos todavía. Agrega desde la paleta.
          </Box>
        )}
        {campos.map((c, i) => {
          const elegido = seleccion === c.uid;
          return (
            <Box key={c.uid}>
              {hueco === i && marcador}
              <Box
                onDragOver={(e) => { if (aceptar(e)) { e.preventDefault(); e.stopPropagation(); setHueco(indiceSobre(e, i)); } }}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.25, border: '1px solid #e6e9f2', borderLeft: `4px solid ${elegido ? MARCA.dorado : MARCA.azul700}`,
                  borderRadius: '10px', bgcolor: '#fff', px: 1.5, py: 1.25, mb: 1,
                  ...(elegido ? { borderColor: MARCA.dorado, boxShadow: '0 0 0 2px rgba(245,184,61,.25)' } : {}),
                }}
              >
                <Box
                  draggable title="Arrastrar" aria-hidden
                  onDragStart={(e: DragEvent) => { e.dataTransfer.setData(MIME_CAMPO, String(c.uid)); e.dataTransfer.effectAllowed = 'move'; }}
                  onDragEnd={() => setHueco(null)}
                  sx={{ cursor: 'grab', color: '#9aa6c0', display: 'flex' }}
                >
                  <DragIcon fontSize="small" />
                </Box>
                <Box
                  component="button" type="button" onClick={() => onSeleccionar(c.uid)}
                  sx={{ flex: 1, minWidth: 0, cursor: 'pointer', border: 0, bgcolor: 'transparent', p: 0, textAlign: 'left', font: 'inherit', color: 'inherit' }}
                >
                  <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{c.label || '(sin etiqueta)'}</Typography>
                  <Etiquetas c={c} expresiones={expresiones} />
                </Box>
                <Tooltip title="Quitar">
                  <IconButton size="small" color="error" aria-label={`Quitar ${c.label}`} onClick={() => onQuitar(c.uid)} sx={{ border: 1, borderRadius: '8px' }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          );
        })}
        {hueco !== null && hueco >= campos.length && marcador}
      </Box>
    </Columna>
  );
}

function Fila({ etiqueta, children }: { etiqueta?: string; children: ReactNode }) {
  return (
    <Box sx={{ mb: 1.25 }}>
      {etiqueta && <InputLabel sx={{ fontSize: 12, fontWeight: 600, color: '#27324a', mb: 0.25 }}>{etiqueta}</InputLabel>}
      {children}
    </Box>
  );
}

function Propiedades({ campo: c, previos, expresiones, onChange, onAyuda }: {
  campo: CampoEditable | null; previos: CampoEditable[]; expresiones: Expresion[]; onChange: (cambios: Partial<CampoEditable>) => void; onAyuda: () => void;
}) {
  if (!c) {
    return <Columna titulo="Propiedades"><Typography sx={{ color: 'text.secondary', fontSize: 13 }}>Selecciona un campo del lienzo.</Typography></Columna>;
  }
  const texto = (valor: string, cambio: (v: string) => void, extra: object = {}) => (
    <TextField fullWidth size="small" value={valor} onChange={(e) => cambio(e.target.value)} {...extra} />
  );
  const aplicables = expresiones.filter((e) => tiposDe(e).includes(c.type));
  const limite = c.type === 'number' ? 'valor' : 'longitud';

  return (
    <Columna titulo="Propiedades">
      <Fila etiqueta="Etiqueta">{texto(c.label, (label) => onChange({ label }))}</Fila>
      <Fila etiqueta="Clave (k)">{texto(c.k, (k) => onChange({ k }), { slotProps: { htmlInput: { maxLength: 40 } } })}</Fila>
      <Fila etiqueta="Placeholder">{texto(c.placeholder, (placeholder) => onChange({ placeholder }))}</Fila>
      <Fila etiqueta="Ayuda">{texto(c.help, (help) => onChange({ help }))}</Fila>
      <FormControlLabel sx={{ mb: 1 }} control={<Switch size="small" checked={c.req} onChange={(_e, req) => onChange({ req })} />} label="Obligatorio" />

      {(c.type === 'text' || c.type === 'textarea' || c.type === 'number') && (
        <>
          <Fila etiqueta={`Mín (${limite})`}>{texto(c.min, (min) => onChange({ min }), { type: 'number' })}</Fila>
          <Fila etiqueta={`Máx (${limite})`}>{texto(c.max, (max) => onChange({ max }), { type: 'number' })}</Fila>
        </>
      )}

      {aplicables.length > 0 && (
        <Fila etiqueta="Validación">
          <TextField
            select fullWidth size="small" value={aplicables.some((e) => e.clave === c.expr) ? c.expr : ''} onChange={(e) => onChange({ expr: e.target.value })}
            slotProps={{
              htmlInput: { 'aria-label': 'Validación del campo' },
              input: {
                endAdornment: (
                  <InputAdornment position="end" sx={{ mr: 2 }}>
                    <Tooltip title="¿Qué hace cada validación?">
                      <IconButton size="small" color="primary" aria-label="Ver ayuda de validaciones" onClick={onAyuda}><InfoIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              },
            }}
          >
            <MenuItem value="">— sin validación —</MenuItem>
            {aplicables.map((e) => <MenuItem key={e.clave} value={e.clave}>{e.nombre}</MenuItem>)}
          </TextField>
        </Fila>
      )}

      {c.type === 'select' && (
        <Fila etiqueta="Opciones">{texto(c.opts, (opts) => onChange({ opts }), { multiline: true, minRows: 4, placeholder: 'Una opción por línea' })}</Fila>
      )}

      {c.type === 'nested' && (
        <>
          <Fila etiqueta="Etiqueta nivel 1">{texto(c.lv1, (lv1) => onChange({ lv1 }))}</Fila>
          <Fila etiqueta="Etiqueta nivel 2">{texto(c.lv2, (lv2) => onChange({ lv2 }))}</Fila>
          <Fila etiqueta="Árbol (padre: hijos)">{texto(c.tree, (tree) => onChange({ tree }), { multiline: true, minRows: 4, placeholder: 'Padre: hijo1, hijo2' })}</Fila>
        </>
      )}

      {previos.length > 0 && (
        <>
          <Fila etiqueta="Mostrar si (campo previo)">
            <TextField
              select fullWidth size="small" value={previos.some((p) => p.k === c.condK) ? c.condK : ''}
              onChange={(e) => onChange({ condK: e.target.value, ...(e.target.value === '' ? { condV: '' } : {}) })}
            >
              <MenuItem value="">— sin condición —</MenuItem>
              {previos.map((p) => <MenuItem key={p.uid} value={p.k}>{p.label} ({p.k})</MenuItem>)}
            </TextField>
          </Fila>
          <Fila etiqueta="…es igual a">{texto(c.condV, (condV) => onChange({ condV }), { disabled: c.condK === '', placeholder: 'valor que activa' })}</Fila>
        </>
      )}
    </Columna>
  );
}

function AyudaExpresiones({ abierto, expresiones, onCerrar }: { abierto: boolean; expresiones: Expresion[]; onCerrar: () => void }) {
  const nombresTipo = (e: Expresion) => tiposDe(e).map((t) => TIPOS[t as TipoCampo]?.label ?? t).join(', ');
  return (
    <Dialog open={abierto} onClose={onCerrar} maxWidth="lg" fullWidth scroll="paper">
      <DialogTitle>Validaciones disponibles</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Elige una validación en el campo para controlar lo que el operador puede escribir. Las de formato rechazan el valor si no coincide; las de
          transformación cambian el texto mientras se escribe.
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow><TableCell>Validación</TableCell><TableCell>Qué hace</TableCell><TableCell>Ejemplo válido</TableCell><TableCell>Ejemplo no válido</TableCell><TableCell>Aplica a</TableCell></TableRow></TableHead>
            <TableBody>
              {expresiones.length === 0 && <TableRow><TableCell colSpan={5} align="center" sx={{ color: 'text.secondary' }}>No hay validaciones configuradas.</TableCell></TableRow>}
              {expresiones.map((e) => (
                <TableRow key={e.clave}>
                  <TableCell sx={{ fontWeight: 600 }}>{e.nombre}</TableCell>
                  <TableCell sx={{ fontSize: 13 }}>{e.descripcion}</TableCell>
                  <TableCell><Box component="code" sx={{ color: 'success.main' }}>{e.ejemplo_valido}</Box></TableCell>
                  <TableCell>{e.ejemplo_invalido ? <Box component="code" sx={{ color: 'error.main' }}>{e.ejemplo_invalido}</Box> : <Box component="span" sx={{ color: 'text.secondary' }}>—</Box>}</TableCell>
                  <TableCell sx={{ fontSize: 13, color: 'text.secondary' }}>{nombresTipo(e)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions><Button variant="contained" onClick={onCerrar}>Entendido</Button></DialogActions>
    </Dialog>
  );
}

// --- Vista previa (modal, también desde el listado) -------------------------------------------------

/** Card «Datos de la búsqueda» (solo lectura) con la primera fila de la BD vigente. */
function DatosBusqueda({ bd }: { bd: BdVigente }) {
  const fila = bd.muestra ?? {};
  const clave = bd.columnas.find((c) => c.k === bd.busqueda) ?? null;
  return (
    <Paper variant="outlined">
      <Box sx={{ px: 2, py: 1.25, fontWeight: 600, borderBottom: 1, borderColor: 'divider', bgcolor: MARCA.cabeceraTabla, borderRadius: '16px 16px 0 0' }}>Datos de la búsqueda</Box>
      <Box sx={{ p: 2 }}>
        {clave && (
          <Box sx={{ mb: 2 }}>
            <InputLabel sx={{ fontSize: 13, fontWeight: 600, mb: 0.5 }}>{clave.label}</InputLabel>
            <TextField
              fullWidth value={valorComoTexto(fila[clave.k])}
              slotProps={{ input: { readOnly: true, endAdornment: <InputAdornment position="end"><IconButton size="small" disabled aria-label="Buscar"><SearchIcon /></IconButton></InputAdornment> } }}
            />
          </Box>
        )}
        <Grid container spacing={0.5} sx={{ fontSize: 14 }}>
          {bd.columnas.filter((c) => c.k !== clave?.k).map((c) => (
            <Grid key={c.k} size={12} sx={{ display: 'flex', gap: 1 }}>
              <Box sx={{ width: '42%', color: 'text.secondary' }}>{c.label}</Box>
              <Box sx={{ flex: 1 }}>{valorComoTexto(fila[c.k]) || '—'}</Box>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Paper>
  );
}

export function VistaPreviaDialog({ abierto, nombre, definicion, bd, onCerrar }: {
  abierto: boolean; nombre: string; definicion: Definicion; bd: BdVigente | null; onCerrar: () => void;
}) {
  const avisos = useAvisos();
  const [valores, setValores] = useState<Valores>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const conBd = bd !== null && bd.columnas.length > 0;
  const validar = () => {
    const r = validarValores(definicion, valores);
    setErrores(r.errores);
    if (r.ok) avisos.ok('Validación OK.');
    else avisos.error('Hay errores en el formulario.');
  };
  const cerrar = () => { setValores({}); setErrores({}); onCerrar(); };

  return (
    <Dialog open={abierto} onClose={cerrar} maxWidth="lg" fullWidth>
      <DialogTitle>Vista previa — {nombre}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={3} sx={{ justifyContent: 'center' }}>
          {conBd && <Grid size={{ xs: 12, lg: 5 }}><DatosBusqueda bd={bd} /></Grid>}
          <Grid size={{ xs: 12, lg: conBd ? 7 : 8 }}>
            {definicion.campos.length === 0 ? <Typography color="text.secondary">El formulario no tiene campos.</Typography> : (
              <Stack spacing={2.5} component="form" noValidate onSubmit={(e) => { e.preventDefault(); validar(); }}>
                {camposVisibles(definicion, valores).map((c) => (
                  <CampoDinamico
                    key={c.k || c.label} campo={c} valor={valores[c.k]} error={errores[c.k]}
                    onChange={(v: ValorCampo) => setValores({ ...valores, [c.k]: v })}
                  />
                ))}
              </Stack>
            )}
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={cerrar}>Cerrar</Button>
        <Button variant="contained" onClick={validar} disabled={definicion.campos.length === 0}>Validar</Button>
      </DialogActions>
    </Dialog>
  );
}

// --- Historial de versiones (modal) ----------------------------------------------------------------

interface Version { id: number; version: number; nota: string | null; vigente: boolean; fecha: string }

function VersionesDialog({ abierto, formId, onCerrar, onVigente }: { abierto: boolean; formId: number; onCerrar: () => void; onVigente: () => void }) {
  const avisos = useAvisos();
  const versiones = useQuery({
    queryKey: ['constructor', 'historial', formId], enabled: abierto,
    queryFn: () => api.get<Version[]>(`/constructor/formularios/${formId}/historial`),
  });
  const vigente = useMutation({
    mutationFn: (v: Version) => api.post(`/constructor/formularios/${formId}/versiones/${v.id}/vigente`),
    onSuccess: () => {
      avisos.ok('Versión marcada como vigente.');
      onVigente();
    },
    onError: (e) => avisos.error(e),
  });
  return (
    <Dialog open={abierto} onClose={onCerrar} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle>Historial de versiones</DialogTitle>
      <DialogContent dividers>
        <Consulta query={versiones}>
          {(lista) => (lista.length === 0 ? <Typography color="text.secondary">Sin versiones.</Typography> : (
            <List disablePadding sx={{ border: 1, borderColor: 'divider', borderRadius: '12px' }}>
              {lista.map((v, i) => (
                <ListItem
                  key={v.id} divider={i < lista.length - 1}
                  secondaryAction={v.vigente ? null : <Button size="small" variant="outlined" disabled={vigente.isPending} onClick={() => vigente.mutate(v)}>Hacer vigente</Button>}
                >
                  <ListItemText primary={<>v{v.version} · {fechaHora(v.fecha)}{v.nota ? ` · ${v.nota}` : ''}{v.vigente && <> · <strong>vigente</strong></>}</>} />
                </ListItem>
              ))}
            </List>
          ))}
        </Consulta>
      </DialogContent>
      <DialogActions><Button variant="outlined" onClick={onCerrar}>Cerrar</Button></DialogActions>
    </Dialog>
  );
}

// --- Paso 3: base de datos -------------------------------------------------------------------------

interface Analisis { headers: string[]; filas_total: number; muestra: string[][] }
interface Carga { id: number; archivo: string; filas: number; vigente: boolean; fecha: string }

/** Columna de búsqueda sugerida (cédula/documento/RIF), como `sugerirBusqueda()` del PHP. */
const sugerirBusqueda = (headers: string[]): string => headers.find((h) => /c[eé]dula|documento|doc|rif|^ci$|identificaci/i.test(h)) ?? headers[0] ?? '';

function BaseDatos({ formId, onBd }: { formId: number; onBd: (bd: BdVigente | null) => void }) {
  const avisos = useAvisos();
  const cache = useQueryClient();
  const entrada = useRef<HTMLInputElement>(null);
  const cargas = useQuery({
    queryKey: ['constructor', 'cargas', formId],
    queryFn: () => api.get<{ cargas: Carga[]; vigente: BdVigente | null }>(`/constructor/formularios/${formId}/cargas`),
  });
  // La vista previa del editor usa la BD vigente que se ve en este paso.
  useEffect(() => { if (cargas.data) onBd(cargas.data.vigente); }, [cargas.data, onBd]);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [mostrar, setMostrar] = useState<Record<string, string>>({});
  const [busqueda, setBusqueda] = useState('');

  const reiniciar = () => {
    setArchivo(null);
    setAnalisis(null);
    setMostrar({});
    setBusqueda('');
    if (entrada.current) entrada.current.value = '';
  };
  const refrescar = () => cache.invalidateQueries({ queryKey: ['constructor', 'cargas', formId] });

  const analizar = useMutation({
    mutationFn: (f: File) => {
      const datos = new FormData();
      datos.set('archivo', f);
      return api.post<Analisis>('/constructor/cargas/analizar', datos);
    },
    onSuccess: (r) => {
      setAnalisis(r);
      setMostrar(Object.fromEntries(r.headers.map((h) => [h, h])));
      setBusqueda(sugerirBusqueda(r.headers));
    },
    onError: (e) => avisos.error(e),
  });
  const confirmar = useMutation({
    mutationFn: () => {
      const datos = new FormData();
      if (archivo) datos.set('archivo', archivo);
      datos.set('columnas', JSON.stringify({ busqueda, columnas: (analisis?.headers ?? []).filter((h) => h in mostrar).map((h) => ({ col: h, label: (mostrar[h] ?? '').trim() })) }));
      return api.post<{ filas: number; omitidas: number }>(`/constructor/formularios/${formId}/cargas`, datos);
    },
    onSuccess: (r) => {
      avisos.ok(`Carga guardada (${r.filas} filas${r.omitidas > 0 ? `, ${r.omitidas} omitidas sin clave de búsqueda` : ''}).`);
      reiniciar();
      void refrescar();
    },
    onError: (e) => avisos.error(e),
  });
  const vigente = useMutation({
    mutationFn: (c: Carga) => api.post(`/constructor/formularios/${formId}/cargas/${c.id}/vigente`),
    onSuccess: () => { avisos.ok('BD vigente actualizada.'); void refrescar(); },
    onError: (e) => avisos.error(e),
  });

  const analizarArchivo = () => {
    if (!archivo) { avisos.error('Selecciona un archivo.'); return; }
    if (archivo.size > CARGA_MAX_BYTES_FORMULARIO) { avisos.error('El archivo supera el tamaño máximo (20 MB).'); return; }
    analizar.mutate(archivo);
  };
  const confirmarCarga = () => {
    if (!archivo) { avisos.error('Vuelve a seleccionar el archivo.'); return; }
    if (Object.keys(mostrar).length === 0) { avisos.error('Elige al menos una columna para mostrar.'); return; }
    if (!busqueda) { avisos.error('Marca la columna de búsqueda.'); return; }
    confirmar.mutate();
  };

  return (
    <Columna titulo="Base de datos del formulario">
      <Consulta query={cargas}>
        {(r) => {
          const clave = r.vigente?.columnas.find((c) => c.k === r.vigente?.busqueda);
          return (
            <>
              <Box sx={{ mb: 2, fontSize: 14 }}>
                {r.vigente ? (
                  <><PildoraEstado activo texto="BD vigente" /> {r.vigente.archivo} · {r.vigente.filas} filas · {fechaHora(r.vigente.fecha)}{clave && <> · búsqueda por <strong>{clave.label}</strong></>}</>
                ) : <Typography component="span" color="text.secondary" sx={{ fontSize: 14 }}>Sin BD vigente: el formulario se muestra centrado, sin card de búsqueda.</Typography>}
              </Box>

              <Grid container spacing={1.5} sx={{ alignItems: 'flex-end', mb: 2 }}>
                <Grid size={{ xs: 12, md: 8 }}>
                  <InputLabel htmlFor="cnsArchivo" sx={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', color: 'text.primary', mb: 0.5 }}>
                    Cargar nueva BD (.csv / .xlsx)
                  </InputLabel>
                  <TextField
                    id="cnsArchivo" fullWidth type="file" inputRef={entrada} slotProps={{ htmlInput: { accept: '.csv,.txt,.xlsx' } }}
                    onChange={(e) => { setArchivo((e.target as HTMLInputElement).files?.[0] ?? null); setAnalisis(null); }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Button variant="outlined" onClick={analizarArchivo} loading={analizar.isPending} sx={{ height: 40 }}>Analizar archivo</Button>
                </Grid>
              </Grid>

              {analisis && (
                <Box sx={{ mb: 2 }}>
                  <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Columnas de la card «Datos de la búsqueda»</Typography>
                  <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>
                    Independientes de los campos del formulario. Elige qué columnas mostrar, su etiqueta y la columna clave para buscar el registro.
                  </Typography>
                  <TableContainer sx={{ mb: 2 }}>
                    <Table size="small">
                      <TableHead><TableRow><TableCell sx={{ width: 70 }}>Mostrar</TableCell><TableCell>Columna del archivo</TableCell><TableCell>Etiqueta</TableCell><TableCell align="center" sx={{ width: 90 }}>Búsqueda</TableCell></TableRow></TableHead>
                      <TableBody>
                        {analisis.headers.map((h) => {
                          const visible = h in mostrar;
                          return (
                            <TableRow key={h}>
                              <TableCell>
                                <Checkbox
                                  size="small" checked={visible} slotProps={{ input: { 'aria-label': `Mostrar ${h}` } }}
                                  onChange={(_e, marcar) => {
                                    const { [h]: _quitada, ...resto } = mostrar;
                                    setMostrar(marcar ? { ...mostrar, [h]: h } : resto);
                                    if (!marcar && busqueda === h) setBusqueda('');
                                  }}
                                />
                              </TableCell>
                              <TableCell><code>{h}</code></TableCell>
                              <TableCell>
                                <TextField fullWidth size="small" value={mostrar[h] ?? h} disabled={!visible} onChange={(e) => setMostrar({ ...mostrar, [h]: e.target.value })} slotProps={{ htmlInput: { maxLength: 80, 'aria-label': `Etiqueta de ${h}` } }} />
                              </TableCell>
                              <TableCell align="center">
                                {/* La columna de búsqueda siempre se muestra. */}
                                <Radio size="small" checked={busqueda === h} onChange={() => { setBusqueda(h); if (!visible) setMostrar({ ...mostrar, [h]: h }); }} slotProps={{ input: { 'aria-label': `Buscar por ${h}` } }} />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>Muestra del archivo</Typography>
                  <TableContainer sx={{ mb: 1.5, border: 1, borderColor: 'divider', borderRadius: '10px' }}>
                    <Table size="small" sx={{ '& td, & th': { fontSize: 12 } }}>
                      <TableHead><TableRow>{analisis.headers.map((h) => <TableCell key={h}>{h}</TableCell>)}</TableRow></TableHead>
                      <TableBody>{analisis.muestra.map((fila, i) => <TableRow key={i}>{fila.map((v, j) => <TableCell key={j}>{v}</TableCell>)}</TableRow>)}</TableBody>
                    </Table>
                  </TableContainer>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <Button variant="contained" onClick={confirmarCarga} loading={confirmar.isPending}>Confirmar carga</Button>
                    <Typography color="text.secondary" sx={{ fontSize: 14 }}>{analisis.filas_total} filas en el archivo.</Typography>
                  </Stack>
                </Box>
              )}

              <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
                <Typography sx={{ fontWeight: 600, mb: 1 }}>Historial de cargas</Typography>
                {r.cargas.length === 0 ? <Typography color="text.secondary" sx={{ fontSize: 14 }}>Sin cargas.</Typography> : (
                  <List disablePadding sx={{ border: 1, borderColor: 'divider', borderRadius: '12px' }}>
                    {r.cargas.map((c, i) => (
                      <ListItem
                        key={c.id} divider={i < r.cargas.length - 1}
                        secondaryAction={c.vigente ? null : <Button size="small" variant="outlined" disabled={vigente.isPending} onClick={() => vigente.mutate(c)}>Hacer vigente</Button>}
                      >
                        <ListItemText primary={<>{c.archivo} · {c.filas} filas · {fechaHora(c.fecha)}{c.vigente && <> · <strong>vigente</strong></>}</>} />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            </>
          );
        }}
      </Consulta>
    </Columna>
  );
}

// --- Indicador de pasos ------------------------------------------------------------------------------

const PASOS = [{ n: 1, texto: 'Lienzo' }, { n: 2, texto: 'Servicio' }, { n: 3, texto: 'Base de datos' }] as const;
type Paso = 1 | 2 | 3;

function IndicadorPasos({ paso, pasoMax, onIr }: { paso: Paso; pasoMax: Paso; onIr: (p: Paso) => void }) {
  return (
    <Box component="ol" sx={{ display: 'flex', gap: 1, listStyle: 'none', p: 0, m: 0, mb: 2 }}>
      {PASOS.map(({ n, texto }) => {
        const activo = n === paso;
        const hecho = n < paso;
        return (
          <Box component="li" key={n} sx={{ flex: 1, minWidth: 0 }}>
            <Box
              component="button" type="button" disabled={n > pasoMax} onClick={() => onIr(n)} aria-current={activo ? 'step' : undefined}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.25, width: '100%', border: 0, borderRadius: '12px', bgcolor: '#fff', boxShadow: activo ? `0 0 0 2px ${MARCA.dorado}` : SOMBRA.tarjeta,
                px: 1.75, py: 1.25, fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: activo ? MARCA.azul700 : '#6b7280', textAlign: 'left', cursor: 'pointer',
                '&:disabled': { cursor: 'default', opacity: 0.65 },
              }}
            >
              <Box
                component="span"
                sx={{
                  flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: '50%', fontSize: 13,
                  bgcolor: activo ? MARCA.azul700 : hecho ? '#e6f4ea' : '#eef2fb', color: activo ? '#fff' : hecho ? '#1e7e40' : '#27324a',
                }}
              >
                {n}
              </Box>
              <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{texto}</Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// --- Editor ---------------------------------------------------------------------------------------------

interface OpcionesGuardar { despues?: () => void; reasignar?: boolean; sinCampanaOk?: boolean; activo?: boolean }

function Editor({ detalle, catalogos, pasoInicial, onVolver, onRecargar }: {
  detalle: Detalle | null; catalogos: Catalogos; pasoInicial: Paso; onVolver: () => void; onRecargar: (formId: number, paso: Paso) => void;
}) {
  const avisos = useAvisos();
  const inicial = detalle?.formulario ?? null;
  const expresionesIdx = useMemo(() => indexarExpresiones(catalogos.expresiones), [catalogos.expresiones]);

  const [formId, setFormId] = useState<number | null>(inicial?.id ?? null);
  const [version, setVersion] = useState<number | null>(inicial?.version ?? null);
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [boton, setBoton] = useState(inicial?.btn_texto ?? 'Guardar');
  const [activo, setActivo] = useState(inicial?.status_id === REGISTRO.ACTIVO);
  const [servicios, setServicios] = useState<number[]>(inicial?.servicios ?? []);
  const [campos, setCampos] = useState<CampoEditable[]>(() => (inicial ? inicial.definicion.campos.map(aEditable) : []));
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [bd, setBd] = useState<BdVigente | null>(detalle?.bd ?? null);
  const [errores, setErrores] = useState<string[]>([]);

  // Un formulario existente tiene los 3 pasos disponibles; uno nuevo los recorre en orden.
  const [paso, setPaso] = useState<Paso>(pasoInicial);
  const [pasoMax, setPasoMax] = useState<Paso>(inicial ? 3 : pasoInicial);

  const [modal, setModal] = useState<'estado' | 'sinCampana' | 'conflicto' | 'versiones' | 'preview' | 'ayuda' | null>(null);
  const [conflictos, setConflictos] = useState<Conflicto[]>([]);
  const pendiente = useRef<OpcionesGuardar>({});

  /** Datos que se envían al guardar; también es la huella para detectar cambios. */
  const payload = (activoForzado?: boolean) => ({
    nombre: nombre.trim(), status_id: (activoForzado ?? activo) ? REGISTRO.ACTIVO : REGISTRO.INACTIVO, btn_texto: boton.trim() || 'Guardar',
    servicios: [...servicios].sort((a, b) => a - b), definicion: aDefinicion(campos),
  });
  const [ultimoGuardado, setUltimoGuardado] = useState<string | null>(() => (inicial ? JSON.stringify(payload()) : null));

  const irAPaso = (n: Paso) => {
    setPaso(n);
    if (n > pasoMax) setPasoMax(n);
  };

  /** Validación del paso 1 (nombre + campos). */
  const validarLienzo = (): boolean => {
    const errs: string[] = [];
    if (nombre.trim() === '') errs.push('El nombre del formulario es obligatorio.');
    errs.push(...validarDefinicion(aDefinicion(campos), expresionesIdx).errores);
    setErrores(errs);
    return errs.length === 0;
  };

  const guardarMut = useMutation({
    mutationFn: (v: { datos: ReturnType<typeof payload>; reasignar: boolean }) => {
      const cuerpo = { ...v.datos, reasignar: v.reasignar };
      return formId ? api.put<{ id: number; version: number }>(`/constructor/formularios/${formId}`, cuerpo) : api.post<{ id: number; version: number }>('/constructor/formularios', cuerpo);
    },
  });

  const guardar = (opts: OpcionesGuardar = {}) => {
    const despues = opts.despues ?? (() => {});
    if (!validarLienzo()) { irAPaso(1); return; }

    const datos = payload(opts.activo);
    const huella = JSON.stringify(datos);
    if (formId && huella === ultimoGuardado) { despues(); return; } // sin cambios: no crea versión

    if (servicios.length === 0 && !opts.sinCampanaOk) {
      pendiente.current = opts;
      setModal('sinCampana');
      return;
    }

    guardarMut.mutate({ datos, reasignar: opts.reasignar === true }, {
      onSuccess: (r) => {
        setFormId(r.id);
        setVersion(r.version);
        setUltimoGuardado(huella);
        setModal(null);
        avisos.ok(`Formulario guardado (v${r.version}).`);
        despues();
      },
      onError: (e) => {
        if (e instanceof ApiError && e.code === 'conflicto') {
          pendiente.current = { ...opts, sinCampanaOk: true };
          setConflictos((e.datos.conflictos as Conflicto[] | undefined) ?? []);
          setModal('conflicto');
          return;
        }
        setModal(null);
        setErrores(e instanceof ApiError && Array.isArray(e.errores) && e.errores.length > 0 ? e.errores : [mensajeDe(e)]);
        irAPaso(1);
      },
    });
  };

  const siguiente = () => {
    if (paso === 1) { if (validarLienzo()) irAPaso(2); return; }
    // Guarda (si cambió) y entra al paso de la BD, que necesita el formulario guardado.
    if (paso === 2) guardar({ despues: () => irAPaso(3) });
  };
  const anterior = () => { if (paso > 1) { setErrores([]); irAPaso((paso - 1) as Paso); } };
  // Por el indicador: atrás siempre; adelante solo a pasos alcanzados, y salir del lienzo exige que sea válido.
  const saltarAPaso = (n: Paso) => {
    if (n === paso || n > pasoMax) return;
    if (paso === 1 && !validarLienzo()) return;
    setErrores([]);
    irAPaso(n);
  };
  // Finalizar pregunta siempre por el estado: el switch de la cabecera pasa desapercibido.
  const finalizar = () => {
    if (!validarLienzo()) { irAPaso(1); return; }
    setModal('estado');
  };
  const finalizarConEstado = (comoActivo: boolean) => {
    setActivo(comoActivo);
    // El aviso «sin campaña» ya se mostró dentro del modal de estado.
    guardar({ activo: comoActivo, sinCampanaOk: true, despues: onVolver });
  };

  // --- Campos ---
  const agregar = (tipo: TipoCampo, indice?: number) => {
    const nuevo = campoNuevo(tipo, campos);
    const copia = [...campos];
    copia.splice(indice ?? copia.length, 0, nuevo);
    setCampos(copia);
    setSeleccion(nuevo.uid);
  };
  const mover = (uid: number, indice: number) => {
    const desde = campos.findIndex((c) => c.uid === uid);
    if (desde === -1) return;
    const copia = [...campos];
    const [campo] = copia.splice(desde, 1);
    if (!campo) return;
    copia.splice(indice > desde ? indice - 1 : indice, 0, campo);
    setCampos(copia);
  };
  const quitar = (uid: number) => {
    setCampos(campos.filter((c) => c.uid !== uid));
    if (seleccion === uid) setSeleccion(null);
  };
  const cambiarCampo = (uid: number, cambios: Partial<CampoEditable>) => setCampos(campos.map((c) => (c.uid === uid ? { ...c, ...cambios } : c)));

  const iSel = campos.findIndex((c) => c.uid === seleccion);
  const campoSel = iSel >= 0 ? (campos[iSel] ?? null) : null;
  const definicionPrevia = validarDefinicion(aDefinicion(campos), expresionesIdx).definicion;
  const etiquetaFiltro = { fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', color: 'text.primary', mb: 0.5 } as const;

  return (
    <Pagina titulo="Constructor de formularios" subtitulo="Crea, versiona y asigna formularios dinámicos a los servicios.">
      {/* Cabecera del formulario */}
      <Paper variant="outlined" sx={{ p: { xs: 2, md: '20px 24px' }, mb: 2.5, boxShadow: SOMBRA.elevada }}>
        <Grid container spacing={2} sx={{ alignItems: 'flex-end' }}>
          <Grid size={{ xs: 12, lg: 5 }}>
            <InputLabel htmlFor="cnsNombre" sx={etiquetaFiltro}>Nombre del formulario</InputLabel>
            <TextField id="cnsNombre" fullWidth value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Captación Bancaribe" slotProps={{ htmlInput: { maxLength: 150 } }} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <InputLabel htmlFor="cnsBtnTexto" sx={etiquetaFiltro}>Texto del botón</InputLabel>
            <TextField id="cnsBtnTexto" fullWidth value={boton} onChange={(e) => setBoton(e.target.value)} slotProps={{ htmlInput: { maxLength: 80 } }} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3, lg: 2 }}>
            <InputLabel sx={etiquetaFiltro}>Estado</InputLabel>
            <FormControlLabel control={<Switch checked={activo} onChange={(_e, v) => setActivo(v)} />} label={activo ? 'Activo' : 'Inactivo'} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3, lg: 2 }} sx={{ textAlign: { lg: 'right' } }}>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{formId ? `Versión vigente: ${version ?? '—'}` : 'Nuevo'}</Typography>
            {formId && <Button size="small" variant="outlined" startIcon={<HistoryIcon />} sx={{ mt: 0.5 }} onClick={() => setModal('versiones')}>Versiones</Button>}
          </Grid>
        </Grid>
      </Paper>

      <IndicadorPasos paso={paso} pasoMax={pasoMax} onIr={saltarAPaso} />

      {paso === 1 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '220px 1fr 300px' }, gap: 2, alignItems: 'start' }}>
          <Paleta onAgregar={(t) => agregar(t)} />
          <Lienzo
            campos={campos} seleccion={seleccion} expresiones={catalogos.expresiones}
            onSeleccionar={setSeleccion} onQuitar={quitar} onSoltarTipo={agregar} onMover={mover}
          />
          <Propiedades
            key={seleccion ?? 0} campo={campoSel} previos={iSel > 0 ? campos.slice(0, iSel).filter((c) => c.k !== '') : []} expresiones={catalogos.expresiones}
            onChange={(cambios) => campoSel && cambiarCampo(campoSel.uid, cambios)} onAyuda={() => setModal('ayuda')}
          />
        </Box>
      )}

      {paso === 2 && (
        <Columna titulo="Servicios asignados">
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1.5 }}>
            Regla: un solo formulario <strong>activo</strong> por servicio. Solo servicios no bancarios: los de banca conservan su formulario fijo.
          </Typography>
          {catalogos.servicios.length === 0 ? <Typography color="text.secondary">No hay servicios no bancarios para asignar.</Typography> : (
            <Grid container spacing={1}>
              {catalogos.servicios.map((s) => (
                <Grid key={s.id} size={{ xs: 12, md: 4 }}>
                  <FormControlLabel
                    control={<Checkbox checked={servicios.includes(s.id)} onChange={(_e, marcado) => setServicios(marcado ? [...servicios, s.id] : servicios.filter((x) => x !== s.id))} />}
                    label={<>{s.descripcion}{s.status_id !== REGISTRO.ACTIVO && <Box component="span" sx={{ color: 'text.secondary' }}> (inactivo)</Box>}</>}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </Columna>
      )}

      {paso === 3 && (formId
        ? <BaseDatos formId={formId} onBd={setBd} />
        : <Columna titulo="Base de datos del formulario"><Typography color="text.secondary">Guarda el formulario primero para poder cargar su base de datos.</Typography></Columna>)}

      {errores.length > 0 && (
        <Box component="ul" sx={{ mt: 2, mb: 0, fontSize: 13, color: '#b42318' }}>
          {errores.map((e) => <li key={e}>{e}</li>)}
        </Box>
      )}

      <Stack direction="row" sx={{ flexWrap: 'wrap', justifyContent: 'space-between', gap: 1, mt: 2 }}>
        <Button variant="outlined" onClick={onVolver}>Volver al listado</Button>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button variant="outlined" onClick={() => setModal('preview')}>Vista previa</Button>
          {paso > 1 && <Button variant="outlined" startIcon={<ChevronLeftIcon />} onClick={anterior}>Anterior</Button>}
          {paso < 3 && <Button variant="contained" endIcon={<ChevronRightIcon />} onClick={siguiente} loading={guardarMut.isPending && paso === 2}>Siguiente</Button>}
          {paso === 3 && <Button variant="contained" onClick={finalizar}>Finalizar</Button>}
        </Stack>
      </Stack>

      {/* Al finalizar: confirmar el estado. */}
      <Dialog open={modal === 'estado'} onClose={() => !guardarMut.isPending && setModal(null)} maxWidth="sm" fullWidth>
        <DialogTitle>¿Dejar el formulario activo?</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1 }}>Estado actual: <strong>{activo ? 'Activo' : 'Inactivo'}</strong>.</Typography>
          <Box component="ul" sx={{ fontSize: 13, color: 'text.secondary', m: 0, pl: 2.5 }}>
            <li><strong>Activo:</strong> los operadores de las campañas asignadas lo ven y lo usan de inmediato.</li>
            <li><strong>Inactivo:</strong> queda guardado, pero nadie lo ve hasta que lo actives.</li>
          </Box>
          {servicios.length === 0 && <Alert severity="warning" sx={{ mt: 2 }}>No tiene campañas asignadas: aunque quede activo, ningún operador lo verá.</Alert>}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" disabled={guardarMut.isPending} onClick={() => finalizarConEstado(false)}>Dejar inactivo</Button>
          <Button variant="contained" loading={guardarMut.isPending} onClick={() => finalizarConEstado(true)}>Dejar activo</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={modal === 'sinCampana'} onClose={() => setModal(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Formulario sin campaña</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1 }}>No seleccionaste ninguna campaña para este formulario.</Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            Puedes guardarlo así, pero ningún operador lo verá hasta que lo asignes a una campaña en el paso <strong>2 · Servicio</strong>.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" loading={guardarMut.isPending} onClick={() => guardar({ ...pendiente.current, sinCampanaOk: true })}>Continuar sin campaña</Button>
          <Button variant="contained" disabled={guardarMut.isPending} onClick={() => { setModal(null); irAPaso(2); }}>Asignar campaña</Button>
        </DialogActions>
      </Dialog>

      <Confirmacion
        abierto={modal === 'conflicto'} titulo="Conflicto de servicios" confirmar="Reasignar y guardar" ocupado={guardarMut.isPending}
        texto={<><ListaConflictos conflictos={conflictos} /><Typography variant="body2" sx={{ mt: 1 }}>¿Reasignarlos a este formulario y guardar?</Typography></>}
        onCerrar={() => setModal(null)} onConfirmar={() => guardar({ ...pendiente.current, reasignar: true })}
      />

      {formId && (
        <VersionesDialog
          abierto={modal === 'versiones'} formId={formId} onCerrar={() => setModal(null)}
          onVigente={() => { setModal(null); onRecargar(formId, paso); }}
        />
      )}
      <VistaPreviaDialog abierto={modal === 'preview'} nombre={nombre.trim() || '(sin nombre)'} definicion={definicionPrevia} bd={bd} onCerrar={() => setModal(null)} />
      <AyudaExpresiones abierto={modal === 'ayuda'} expresiones={catalogos.expresiones} onCerrar={() => setModal(null)} />
    </Pagina>
  );
}

/**
 * Carga catálogos y el formulario (si se edita). Tras «Hacer vigente» una versión,
 * el editor se reinicia con la definición vigente en el mismo paso.
 */
export function EditorFormulario({ id, onVolver }: { id: number | null; onVolver: () => void }) {
  const cache = useQueryClient();
  const [abierto, setAbierto] = useState<{ id: number | null; paso: Paso; vuelta: number }>({ id, paso: 1, vuelta: 0 });
  const catalogos = useQuery({ queryKey: ['constructor', 'catalogos'], queryFn: () => api.get<Catalogos>('/constructor/catalogos') });
  const detalle = useQuery({
    queryKey: ['constructor', 'formulario', abierto.id, abierto.vuelta], enabled: abierto.id !== null,
    queryFn: () => api.get<Detalle>(`/constructor/formularios/${abierto.id}`), gcTime: 0,
  });
  const recargar = (formId: number, paso: Paso) => {
    void cache.invalidateQueries({ queryKey: ['constructor', 'historial', formId] });
    setAbierto((a) => ({ id: formId, paso, vuelta: a.vuelta + 1 }));
  };

  if (catalogos.error || detalle.error) {
    return (
      <Pagina titulo="Constructor de formularios">
        <Alert severity="error" action={<Button color="inherit" onClick={onVolver}>Volver al listado</Button>}>{mensajeDe(catalogos.error ?? detalle.error)}</Alert>
      </Pagina>
    );
  }
  const clave = `${abierto.id ?? 'nuevo'}-${abierto.vuelta}`;
  return (
    <Consulta query={catalogos}>
      {(c) => (abierto.id === null
        ? <Editor key={clave} detalle={null} catalogos={c} pasoInicial={1} onVolver={onVolver} onRecargar={recargar} />
        : (
          <Consulta query={detalle}>
            {(d) => <Editor key={clave} detalle={d} catalogos={c} pasoInicial={abierto.paso} onVolver={onVolver} onRecargar={recargar} />}
          </Consulta>
        ))}
    </Consulta>
  );
}
