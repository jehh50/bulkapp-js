/**
 * Componentes y utilidades de interfaz comunes a todas las pantallas.
 */
import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, MenuItem, Paper,
  Snackbar, Stack, Tabs, TextField, Typography, type AlertColor, type TextFieldProps,
} from '@mui/material';
import { useLocation } from 'react-router';
import { REGISTRO } from '@bulkapp/shared';
import { mensajeDe } from './api.ts';
import { useUsuario } from './auth.tsx';
import { migaDe } from './menu.ts';
import { MARCA, SOMBRA } from './tema.ts';

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

/**
 * Tarjeta del hero (`.hero__card`): punto de color, etiqueta y valor; con `periodo`
 * añade el separador y el bloque «Período» (como `nav_service` + `nav_period` del PHP).
 */
export function TarjetaHero({ etiqueta, valor, color = MARCA.dorado, sub, periodo }: {
  etiqueta: string; valor: ReactNode; color?: string; sub?: ReactNode; periodo?: string | null;
}) {
  const lbl = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '.8px', color: MARCA.tenue, whiteSpace: 'nowrap' } as const;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: MARCA.azul900, borderRadius: '14px', px: 2.25, py: 1.5, minWidth: 0 }}>
      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color, flex: 'none' }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={lbl}>{etiqueta}</Typography>
        <Typography component="div" sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>{valor}</Typography>
        {sub && <Typography component="div" sx={{ fontSize: 12, color: MARCA.tenue }}>{sub}</Typography>}
      </Box>
      {periodo && (
        <>
          <Box sx={{ width: '1px', alignSelf: 'stretch', bgcolor: MARCA.azul600, mx: 0.75 }} />
          <Box>
            <Typography sx={lbl}>Período</Typography>
            <Typography sx={{ fontSize: 15, fontWeight: 500, lineHeight: 1.4 }}>{periodo}</Typography>
          </Box>
        </>
      )}
    </Box>
  );
}

/**
 * Pantalla con el hero de `nnavbar.php`: miga, título (con acento dorado opcional) y
 * subtítulo sobre azul; a la derecha la campaña activa, los indicadores y las acciones.
 * El contenido se monta sobre el hero (`.app-main`, margen negativo).
 */
export function Pagina({ titulo, acento, subtitulo, miga, acciones, indicadores, campana = true, children }: {
  titulo: string; acento?: string; subtitulo?: string; miga?: string; acciones?: ReactNode; indicadores?: ReactNode;
  /** Muestra la tarjeta «Campaña activa» (si no hay indicadores). */
  campana?: boolean; children: ReactNode;
}) {
  const { pathname } = useLocation();
  const usuario = useUsuario();
  const etiquetaCampana = usuario.campanas.find((c) => c.id === usuario.servicioId)?.etiqueta;
  const derecha = indicadores ?? (campana && etiquetaCampana ? <TarjetaHero etiqueta="Campaña activa" valor={<Box component="span" sx={{ fontSize: 15, fontWeight: 500 }}>{etiquetaCampana}</Box>} /> : null);

  return (
    <Box>
      <Box component="header" sx={{ bgcolor: MARCA.azul700, color: '#fff', pt: { xs: 3, md: 4.5 }, pb: { xs: 10, md: 11.25 } }}>
        <Box sx={{ maxWidth: 1280, mx: 'auto', px: { xs: 2, md: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 13, color: MARCA.tenue, mb: 0.75 }}>{miga ?? migaDe(pathname)}</Typography>
            <Typography component="h1" sx={{ m: 0, fontSize: { xs: 24, md: 30 }, fontWeight: 600, lineHeight: 1.2 }}>
              {titulo}{acento && <> <Box component="span" sx={{ color: MARCA.dorado, fontWeight: 700 }}>{acento}</Box></>}
            </Typography>
            {subtitulo && <Typography sx={{ fontSize: 14, color: MARCA.tenue, mt: 0.75 }}>{subtitulo}</Typography>}
          </Box>
          {(derecha || acciones) && (
            <Stack
              direction="row" spacing={1.5} useFlexGap
              sx={{
                flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center',
                // Botones sobre azul: el principal en dorado (`.btn-gold`), el resto en blanco.
                '& .MuiButton-contained': { bgcolor: MARCA.dorado, color: MARCA.tinta, '&:hover': { bgcolor: MARCA.doradoHover } },
                '& .MuiButton-outlined': { bgcolor: '#fff', borderColor: '#fff', color: MARCA.azul700, '&:hover': { bgcolor: MARCA.fondo, color: MARCA.azul900 } },
                '& .MuiButton-text': { color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,.12)' } },
              }}
            >
              {derecha}
              {acciones}
            </Stack>
          )}
        </Box>
      </Box>
      <Box sx={{ maxWidth: 1280, mx: 'auto', mt: '-56px', mb: 5, px: { xs: 2, md: 3 }, position: 'relative' }}>
        {children}
      </Box>
    </Box>
  );
}

/** Barra de pestañas en tarjeta blanca (va bajo el hero, sobre el azul). */
export function Pestanas<T extends string>({ valor, onCambio, children }: { valor: T; onCambio: (v: T) => void; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ mb: 3, px: { xs: 1, sm: 2 }, boxShadow: SOMBRA.elevada }}>
      <Tabs value={valor} onChange={(_e, v: T) => onCambio(v)} variant="scrollable" allowScrollButtonsMobile>{children}</Tabs>
    </Paper>
  );
}

/** Tarjeta blanca de contenido (`.filter-card` / `.data-card`), con borde superior de color opcional. */
export function Seccion({ titulo, acciones, acento, children, sx }: { titulo?: string; acciones?: ReactNode; acento?: string; children: ReactNode; sx?: object }) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: { xs: 2, sm: 3 }, boxShadow: SOMBRA.elevada, ...(acento ? { borderTop: `5px solid ${acento}` } : {}), ...sx }}
    >
      {(titulo || acciones) && (
        <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
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
  return <Typography variant="body2" color="text.secondary" sx={{ py: 5, px: 3, textAlign: 'center' }}>{children}</Typography>;
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

/** Indicador (`.kpi`): tarjeta blanca con borde superior de color y valor grande. */
export function Indicador({ etiqueta, valor, color = 'primary.main', sub }: { etiqueta: string; valor: ReactNode; color?: string; sub?: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ px: 2.5, py: 2.25, borderTop: 4, borderTopStyle: 'solid', borderTopColor: color, minWidth: 150, flex: 1, boxShadow: SOMBRA.elevada }}>
      <Typography variant="overline" component="div">{etiqueta}</Typography>
      <Typography sx={{ fontSize: { xs: 28, md: 34 }, fontWeight: 700, lineHeight: 1.2, mt: 0.5, fontVariantNumeric: 'tabular-nums' }}>{valor}</Typography>
      {sub && <Typography sx={{ fontSize: 12.5, mt: 0.25 }}>{sub}</Typography>}
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
/** Rango `dd/mm/aaaa – dd/mm/aaaa` (o un solo día), como `nav_period` del PHP. */
export const periodo = (desde: string, hasta: string): string => (desde === hasta ? fechaLarga(desde) : `${fechaLarga(desde)} – ${fechaLarga(hasta)}`);
export const fechaLarga = (fecha: string): string => (fecha ? fecha.slice(0, 10).split('-').reverse().join('/') : '');
export const fechaHora = (iso: string): string => new Date(iso).toLocaleString('es-VE', { timeZone: 'America/Caracas', dateStyle: 'short', timeStyle: 'short' });
export const numero = (n: number): string => n.toLocaleString('es-VE');
