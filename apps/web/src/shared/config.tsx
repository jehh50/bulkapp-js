/**
 * Piezas de las pantallas de Configuración con el aspecto de las vistas PHP
 * (`.pg-*` de productos, `.us-*` de usuarios, `.ca-*` de carga y `.emp-*` de empresas).
 */
import type { ReactNode } from 'react';
import { Box, ButtonBase, InputAdornment, Paper, Table, TableContainer, TextField, Tooltip, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { REGISTRO } from '@bulkapp/shared';
import { MARCA, SOMBRA } from './tema.ts';

/** `.btn-gold` del PHP. */
export const BOTON_DORADO = { bgcolor: MARCA.dorado, color: MARCA.tinta, '&:hover': { bgcolor: MARCA.doradoHover } } as const;

/** `.pg-card`: tarjeta blanca elevada con separación vertical entre bloques. */
export function TarjetaConfig({ children, borde, sx }: { children: ReactNode; borde?: string; sx?: object }) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 2, boxShadow: SOMBRA.elevada, ...(borde ? { borderTop: `5px solid ${borde}` } : {}), ...sx }}
    >
      {children}
    </Paper>
  );
}

/** Título de un formulario dentro de la tarjeta (`.us-formHead h2`). */
export function TituloTarjeta({ titulo, sub, accion }: { titulo: ReactNode; sub?: ReactNode; accion?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
      <Box>
        <Typography component="h2" sx={{ fontSize: 19, fontWeight: 600 }}>{titulo}</Typography>
        {sub && <Typography sx={{ fontSize: 13.5, color: '#6b7280', mt: 0.5 }}>{sub}</Typography>}
      </Box>
      {accion}
    </Box>
  );
}

/** `.pg-lbl`: etiqueta en negrita sobre el control (sin mayúsculas). */
export function Etiqueta({ texto, htmlFor, ayuda, children }: { texto: ReactNode; htmlFor?: string; ayuda?: ReactNode; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0 }}>
      <Typography component="label" htmlFor={htmlFor} sx={{ fontSize: 13, fontWeight: 600 }}>{texto}</Typography>
      {children}
      {ayuda && <Typography sx={{ fontSize: 12, color: '#6b7280' }}>{ayuda}</Typography>}
    </Box>
  );
}

/** Rejilla de dos columnas de los formularios (`.us-grid`). */
export function RejillaForm({ children, columnas = 2 }: { children: ReactNode; columnas?: number }) {
  return <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: `repeat(${columnas},minmax(0,1fr))` }, gap: '14px 16px' }}>{children}</Box>;
}

/** `.pg-actions`: fila de botones con línea superior. */
export function AccionesForm({ children }: { children: ReactNode }) {
  return <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', borderTop: `1px solid ${MARCA.linea}`, pt: 2.25, '& .MuiButton-root': { height: 46, px: 3.25 } }}>{children}</Box>;
}

/** `.pg-search`: buscador de 44px con lupa. */
export function Buscador({ valor, onCambio, placeholder }: { valor: string; onCambio: (v: string) => void; placeholder: string }) {
  return (
    <TextField
      value={valor} onChange={(e) => onCambio(e.target.value)} placeholder={placeholder}
      sx={{ flex: '1 1 220px', maxWidth: 360 }}
      slotProps={{ htmlInput: { 'aria-label': placeholder }, input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
    />
  );
}

/** `.pg-tableWrap`: tabla con borde redondeado y scroll horizontal. */
export function TablaConfig({ children, minimo = 820 }: { children: ReactNode; minimo?: number }) {
  return (
    <TableContainer sx={{ border: '1px solid #dfe5f2', borderRadius: '12px' }}>
      <Table sx={{ minWidth: minimo, '& td': { fontSize: 14, py: 1.25 }, '& tr.Mui-selected td': { bgcolor: '#f4f7fd' } }}>{children}</Table>
    </TableContainer>
  );
}

/** Botones cuadrados de 36px: editar (azul) y eliminar (rojo suave). */
export function BotonIcono({ titulo, tono = 'editar', onClick, disabled, children }: {
  titulo: string; tono?: 'editar' | 'eliminar' | 'neutro'; onClick: () => void; disabled?: boolean; children: ReactNode;
}) {
  const colores = {
    editar: { bgcolor: MARCA.azul700, color: '#fff', '&:hover': { bgcolor: MARCA.azul900 } },
    eliminar: { bgcolor: '#fde0e0', color: '#b42318', '&:hover': { bgcolor: '#f9caca' } },
    neutro: { bgcolor: '#fff', color: MARCA.azul700, border: '1px solid #d7deee', '&:hover': { bgcolor: '#eef2fb' } },
  }[tono];
  return (
    <Tooltip title={titulo}>
      <span>
        <ButtonBase
          aria-label={titulo} onClick={onClick} disabled={disabled}
          sx={{ width: 36, height: 36, borderRadius: '8px', '& svg': { fontSize: 18 }, '&.Mui-disabled': { opacity: 0.4 }, ...colores }}
        >
          {children}
        </ButtonBase>
      </span>
    </Tooltip>
  );
}

const pildora = { display: 'inline-block', fontSize: 12, fontWeight: 600, px: 1.5, py: 0.375, borderRadius: '20px', whiteSpace: 'nowrap' } as const;

/** `.pg-svc`: nombre de campaña/servicio en píldora azul. */
export const PildoraServicio = ({ children }: { children: ReactNode }) => <Box component="span" sx={{ ...pildora, bgcolor: '#e8eefb', color: MARCA.azul700 }}>{children}</Box>;

/** `.us-pill--on/off`: ACTIVO en verde, INACTIVO en rojo. */
export function PildoraEstado({ statusId, femenino, suave }: { statusId: number; femenino?: boolean; suave?: boolean }) {
  const activo = statusId === REGISTRO.ACTIVO;
  const texto = activo ? (femenino ? 'Activa' : 'Activo') : (femenino ? 'Inactiva' : 'Inactivo');
  // `suave`: estilo de empresas.css (gris para inactivo, en minúscula).
  const sx = suave
    ? (activo ? { bgcolor: '#e6f4ea', color: '#1e7e40' } : { bgcolor: '#f1f3f7', color: '#6b7280' })
    : (activo ? { bgcolor: '#d3f0e6', color: '#0b6b4f' } : { bgcolor: '#fde0e0', color: '#b42318' });
  return <Box component="span" sx={{ ...pildora, ...sx }}>{suave ? texto : texto.toUpperCase()}</Box>;
}

/** `.emp-chip`: etiqueta gris redondeada. */
export const Ficha = ({ children, tono = 'gris' }: { children: ReactNode; tono?: 'gris' | 'dorado' }) => (
  <Box component="span" sx={{ ...pildora, ...(tono === 'dorado' ? { bgcolor: '#fdf0cf', color: '#8a5a00' } : { bgcolor: '#f1f4fa', color: MARCA.tinta }) }}>{children}</Box>
);

/** Texto secundario bajo un nombre en una celda (`.emp-sub`). */
export const SubCelda = ({ children }: { children: ReactNode }) => <Box component="span" sx={{ display: 'block', fontSize: 12, color: '#6b7280', maxWidth: 420 }}>{children}</Box>;

/** `.pg-error`: caja de error en línea. */
export const ErrorForm = ({ children }: { children: ReactNode }) => (
  <Box role="alert" sx={{ p: '12px 16px', borderRadius: '10px', bgcolor: '#fdecec', border: '1px solid #f3c2c2', fontSize: 14, color: '#b42318', overflowWrap: 'anywhere' }}>{children}</Box>
);

/** `.ca-alert`: aviso informativo azul. */
export const AvisoInfo = ({ children }: { children: ReactNode }) => (
  <Box sx={{ display: 'flex', gap: 1.25, p: '12px 16px', borderRadius: '10px', bgcolor: '#eef4ff', border: '1px solid #d5e2fb', fontSize: 13.5, color: '#334176', overflowWrap: 'anywhere' }}>
    <span aria-hidden>ℹ</span><Box sx={{ minWidth: 0 }}>{children}</Box>
  </Box>
);

/** `.us-toast`: aviso verde/rojo que se cierra con ×. */
export function Aviso({ tipo = 'ok', onCerrar, children }: { tipo?: 'ok' | 'error'; onCerrar: () => void; children: ReactNode }) {
  return (
    <Box
      role="status"
      sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, mb: 1.75, p: '12px 16px', borderRadius: '12px', fontSize: 14,
        boxShadow: '0 4px 12px rgba(18,48,107,.1)', ...(tipo === 'ok' ? { bgcolor: '#d3f0e6', border: '1px solid #a9dcc8' } : { bgcolor: '#fdecec', border: '1px solid #f3c2c2' }),
      }}
    >
      <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>{tipo === 'ok' ? '✓ ' : '⚠ '}{children}</Box>
      <ButtonBase aria-label="Cerrar" onClick={onCerrar} sx={{ width: 32, height: 32, fontSize: 18, flex: 'none' }}>×</ButtonBase>
    </Box>
  );
}
