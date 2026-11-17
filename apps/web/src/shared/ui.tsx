/**
 * Componentes y utilidades de interfaz comunes a todas las pantallas.
 */
import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, MenuItem, Paper,
  Snackbar, Stack, TextField, Typography, type AlertColor, type TextFieldProps,
} from '@mui/material';
import { REGISTRO } from '@bulkapp/shared';
import { mensajeDe } from './api.ts';

// --- Avisos (snackbar) -----------------------------------------------------------

interface Avisos {
  ok: (mensaje: string) => void;
  error: (e: unknown) => void;
  info: (mensaje: string) => void;
}
const AvisosContext = createContext<Avisos | null>(null);

export function AvisosProvider({ children }: { children: ReactNode }) {
  const [aviso, setAviso] = useState<{ mensaje: string; tipo: AlertColor; id: number } | null>(null);
  const mostrar = useCallback((mensaje: string, tipo: AlertColor) => setAviso({ mensaje, tipo, id: Date.now() }), []);
  const valor = useMemo<Avisos>(() => ({
    ok: (m) => mostrar(m, 'success'),
    info: (m) => mostrar(m, 'info'),
    error: (e) => mostrar(typeof e === 'string' ? e : mensajeDe(e), 'error'),
  }), [mostrar]);

  return (
    <AvisosContext value={valor}>
      {children}
      <Snackbar
        key={aviso?.id}
        open={aviso !== null}
        autoHideDuration={aviso?.tipo === 'error' ? 8000 : 4000}
        onClose={(_e, motivo) => { if (motivo !== 'clickaway') setAviso(null); }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={aviso?.tipo ?? 'info'} variant="filled" onClose={() => setAviso(null)} sx={{ minWidth: 280 }}>
          {aviso?.mensaje}
        </Alert>
      </Snackbar>
    </AvisosContext>
  );
}

export function useAvisos(): Avisos {
  const avisos = use(AvisosContext);
  if (!avisos) throw new Error('useAvisos debe usarse dentro de <AvisosProvider>.');
  return avisos;
}

// --- Estructura de página ----------------------------------------------------------

export function Pagina({ titulo, subtitulo, acciones, children }: { titulo: string; subtitulo?: string; acciones?: ReactNode; children: ReactNode }) {
  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3, alignItems: { sm: 'flex-end' }, justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h5" component="h1">{titulo}</Typography>
          {subtitulo && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{subtitulo}</Typography>}
        </Box>
        {acciones && <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>{acciones}</Stack>}
      </Stack>
      {children}
    </Box>
  );
}

export function Seccion({ titulo, acciones, children, sx }: { titulo?: string; acciones?: ReactNode; children: ReactNode; sx?: object }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, ...sx }}>
      {(titulo || acciones) && (
        <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          {titulo && <Typography variant="subtitle1" component="h2">{titulo}</Typography>}
          {acciones}
        </Stack>
      )}
      {children}
    </Paper>
  );
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ py: 6, alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }} role="status">
      <CircularProgress size={22} />
      <Typography variant="body2">{texto}</Typography>
    </Stack>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <Typography variant="body2" color="text.secondary" sx={{ py: 5, textAlign: 'center' }}>{children}</Typography>;
}

/** Estado de carga de una consulta: spinner, error con reintento, o el contenido. */
export function Consulta<T>({ query, children }: {
  query: { data: T | undefined; isPending: boolean; error: unknown; refetch: () => unknown };
  children: (datos: T) => ReactNode;
}) {
  if (query.data !== undefined) return <>{children(query.data)}</>;
  if (query.isPending) return <Cargando />;
  return (
    <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void query.refetch()}>Reintentar</Button>}>
      {mensajeDe(query.error)}
    </Alert>
  );
}

export function Indicador({ etiqueta, valor, color = 'primary.main' }: { etiqueta: string; valor: ReactNode; color?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderLeft: 4, borderLeftColor: color, minWidth: 150, flex: 1 }}>
      <Typography variant="caption" color="text.secondary">{etiqueta}</Typography>
      <Typography variant="h5" sx={{ fontVariantNumeric: 'tabular-nums' }}>{valor}</Typography>
    </Paper>
  );
}

export function ChipEstado({ statusId }: { statusId: number }) {
  const activo = statusId === REGISTRO.ACTIVO;
  return <Chip size="small" label={activo ? 'Activo' : 'Inactivo'} color={activo ? 'success' : 'default'} variant={activo ? 'filled' : 'outlined'} />;
}

// --- Formularios -------------------------------------------------------------------

export interface Opcion { value: string | number; label: string; disabled?: boolean }

/** Select de MUI con opción vacía opcional. */
export function Selector({ opciones, vacio, ...props }: Omit<TextFieldProps, 'select' | 'children'> & { opciones: Opcion[]; vacio?: string }) {
  return (
    <TextField select fullWidth size="small" {...props}>
      {vacio !== undefined && <MenuItem value="">{vacio}</MenuItem>}
      {opciones.map((o) => <MenuItem key={o.value} value={o.value} disabled={o.disabled}>{o.label}</MenuItem>)}
    </TextField>
  );
}

export function CampoFecha(props: TextFieldProps) {
  return <TextField type="date" size="small" fullWidth slotProps={{ inputLabel: { shrink: true } }} {...props} />;
}

export function Confirmacion({ abierto, titulo, texto, confirmar = 'Confirmar', peligro, ocupado, onConfirmar, onCerrar }: {
  abierto: boolean; titulo: string; texto: ReactNode; confirmar?: string; peligro?: boolean; ocupado?: boolean;
  onConfirmar: () => void; onCerrar: () => void;
}) {
  return (
    <Dialog open={abierto} onClose={ocupado ? undefined : onCerrar} maxWidth="xs" fullWidth>
      <DialogTitle>{titulo}</DialogTitle>
      <DialogContent><DialogContentText component="div">{texto}</DialogContentText></DialogContent>
      <DialogActions>
        <Button onClick={onCerrar} disabled={ocupado}>Cancelar</Button>
        <Button variant="contained" color={peligro ? 'error' : 'primary'} onClick={onConfirmar} loading={ocupado}>{confirmar}</Button>
      </DialogActions>
    </Dialog>
  );
}

// --- Fechas ------------------------------------------------------------------------

/** Fecha de hoy `AAAA-MM-DD` en la zona horaria de negocio. */
export const hoy = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date());
export const fechaLarga = (fecha: string): string => (fecha ? fecha.slice(0, 10).split('-').reverse().join('/') : '');
export const fechaHora = (iso: string): string => new Date(iso).toLocaleString('es-VE', { timeZone: 'America/Caracas', dateStyle: 'short', timeStyle: 'short' });
export const numero = (n: number): string => n.toLocaleString('es-VE');
