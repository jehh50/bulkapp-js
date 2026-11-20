/**
 * Piezas visuales de los reportes con el aspecto del layout PHP (`nheader.php`):
 * tarjeta de filtros con etiquetas en mayúsculas, KPIs, donas con leyenda,
 * barras de progreso, píldoras y tarjetas con cabecera de color.
 */
import type { ReactNode } from 'react';
import { Box, InputLabel, Paper, Typography } from '@mui/material';
import { MARCA, SOMBRA } from './tema.ts';

/** Porcentaje con dos decimales como máximo (`rep_pct` del PHP). */
export const porcentaje = (parte: number, total: number): number => (total > 0 ? Math.round((parte / total) * 10000) / 100 : 0);
/** Porcentaje con un decimal y coma decimal (`dpct` del dashboard PHP). */
export const porcentajeTexto = (parte: number, total: number): string =>
  total > 0 ? `${((parte / total) * 100).toLocaleString('es-VE', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%` : '0%';

/** Color por posición (ángulo áureo), como en ventas por estado del PHP. */
export const colorSerie = (i: number): string => `hsl(${(i * 137.5 + 220) % 360} 58% 46%)`;

// --- Tarjetas -----------------------------------------------------------------------

/** `.filter-card`: tarjeta blanca elevada para los filtros. */
export function TarjetaFiltros({ children }: { children: ReactNode }) {
  return <Paper variant="outlined" sx={{ p: { xs: 2, md: '20px 24px' }, mb: 2.5, boxShadow: SOMBRA.elevada }}>{children}</Paper>;
}

/** `.data-card`: tarjeta blanca de datos, sin relleno (la tabla va a sangre). */
export function TarjetaDatos({ children, sx }: { children: ReactNode; sx?: object }) {
  return <Paper variant="outlined" sx={{ overflow: 'hidden', mb: 2.5, ...sx }}>{children}</Paper>;
}

/** `.data-empty`: mensaje centrado dentro de una tarjeta de datos. */
export function SinDatos({ children }: { children: ReactNode }) {
  return <TarjetaDatos><Box sx={{ textAlign: 'center', color: '#6b7280', p: '40px 24px', fontSize: 14 }}>{children}</Box></TarjetaDatos>;
}

/** Etiqueta en mayúsculas sobre el control (`.filter-label`). */
export function CampoFiltro({ etiqueta, htmlFor, children }: { etiqueta: string; htmlFor?: string; children: ReactNode }) {
  return (
    <Box>
      <InputLabel htmlFor={htmlFor} sx={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', color: 'text.primary', mb: 0.75 }}>
        {etiqueta}
      </InputLabel>
      {children}
    </Box>
  );
}

/** Tarjeta con cabecera de color: título a la izquierda y cifra grande a la derecha. */
export function TarjetaCabecera({ titulo, total, sub, color, children, sx }: {
  titulo: string; total?: ReactNode; sub?: string; color: string; children: ReactNode; sx?: object;
}) {
  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden', height: '100%', ...sx }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, p: 2, bgcolor: color, color: '#fff' }}>
        <Typography sx={{ fontSize: 18, fontWeight: 600 }}>{titulo}</Typography>
        {total !== undefined && (
          <Box sx={{ textAlign: 'right' }}>
            <Typography sx={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{total}</Typography>
            {sub && <Typography sx={{ fontSize: 13, color: '#f6cfcf' }}>{sub}</Typography>}
          </Box>
        )}
      </Box>
      <Box sx={{ p: 2 }}>{children}</Box>
    </Paper>
  );
}

// --- KPIs ---------------------------------------------------------------------------

/** `.kpi-grid`: rejilla adaptable de indicadores. */
export function RejillaKpi({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(auto-fit,minmax(150px,1fr))', md: 'repeat(auto-fit,minmax(200px,1fr))' }, gap: 1.5, mb: 2.5 }}>
      {children}
    </Box>
  );
}

/** `.kpi`: valor grande con sufijo en línea y/o subtítulo debajo. */
export function Kpi({ etiqueta, valor, color, sufijo, sub }: { etiqueta: string; valor: ReactNode; color: string; sufijo?: ReactNode; sub?: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ px: 2.5, py: 2.25, borderTop: `4px solid ${color}`, boxShadow: SOMBRA.tarjeta }}>
      <Typography sx={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>{etiqueta}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, mt: 0.75 }}>
        <Typography component="span" sx={{ fontSize: { xs: 28, md: 34 }, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{valor}</Typography>
        {sufijo !== undefined && <Typography component="span" sx={{ fontSize: 13, fontWeight: 500 }}>{sufijo}</Typography>}
      </Box>
      {sub !== undefined && <Typography sx={{ fontSize: 13, fontWeight: 500, mt: 0.5 }}>{sub}</Typography>}
    </Paper>
  );
}

// --- Donas y leyendas -----------------------------------------------------------------

export interface ItemSerie { label: string; n: number; color: string }

/** Segmentos `conic-gradient` (`rep_donut` del PHP). */
function gradiente(items: ItemSerie[]): string {
  const total = items.reduce((t, i) => t + i.n, 0);
  if (total <= 0) return '#e5e9f2 0% 100%';
  let acumulado = 0;
  return items.map((i) => {
    const a = (acumulado / total) * 100;
    acumulado += i.n;
    return `${i.color} ${a}% ${(acumulado / total) * 100}%`;
  }).join(',');
}

const TAMANOS = { sm: { d: 168, h: 102, t: 24 }, md: { d: 168, h: 102, t: 24 }, lg: { d: 220, h: 136, t: 32 } } as const;

export function Dona({ items, etiqueta, total, tamano = 'md' }: { items: ItemSerie[]; etiqueta?: string; total?: ReactNode; tamano?: keyof typeof TAMANOS }) {
  const t = TAMANOS[tamano];
  return (
    <Box
      role="img" aria-label={`${etiqueta ?? 'Gráfica'}: ${items.map((i) => `${i.label} ${i.n}`).join(', ')}`}
      sx={{ width: t.d, height: t.d, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', background: `conic-gradient(${gradiente(items)})` }}
    >
      <Box sx={{ width: t.h, height: t.h, borderRadius: '50%', bgcolor: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {etiqueta && <Typography sx={{ fontSize: 11, textTransform: 'uppercase' }}>{etiqueta}</Typography>}
        {total !== undefined && <Typography sx={{ fontSize: t.t, fontWeight: 700, lineHeight: 1.1 }}>{total}</Typography>}
      </Box>
    </Box>
  );
}

/** Muestra de color (`.legend__sw`). */
export const Muestra = ({ color }: { color: string }) => <Box component="span" sx={{ width: 10, height: 10, borderRadius: '3px', flex: 'none', bgcolor: color, display: 'inline-block' }} />;

export function Leyenda({ items }: { items: ItemSerie[] }) {
  const total = items.reduce((t, i) => t + i.n, 0);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minWidth: 180 }}>
      {items.map((i) => (
        <Box key={i.label} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, fontSize: 13 }}>
          <Muestra color={i.color} />
          <Box component="span" sx={{ flex: 1 }}>{i.label}</Box>
          <Box component="span" sx={{ fontWeight: 600 }}>{i.n}</Box>
          <Box component="span" sx={{ width: 52, textAlign: 'right' }}>{porcentaje(i.n, total)}%</Box>
        </Box>
      ))}
    </Box>
  );
}

/** `.chart-card`: título (con acción opcional) y dona con su leyenda. */
export function TarjetaGrafica({ titulo, accion, children }: { titulo: string; accion?: ReactNode; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: '20px 24px' } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
        <Typography sx={{ fontWeight: 600, fontSize: 16 }}>{titulo}</Typography>
        {accion}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 3 }}>{children}</Box>
    </Paper>
  );
}

// --- Barras y píldoras -----------------------------------------------------------------

/** Barra de progreso (`.bar` / `.prog__track`). */
export function BarraProgreso({ pct, color = MARCA.azul700, alto = 8, fondo = '#e5e9f2' }: { pct: number; color?: string; alto?: number; fondo?: string }) {
  return (
    <Box sx={{ height: alto, borderRadius: alto / 2, bgcolor: fondo, overflow: 'hidden', flex: 1 }}>
      <Box sx={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, bgcolor: color }} />
    </Box>
  );
}

/** `.pill`: cifra con fondo de color. */
export function Pildora({ fondo, texto, ancha, children }: { fondo: string; texto: string; ancha?: boolean; children: ReactNode }) {
  return (
    <Box component="span" sx={{ display: 'inline-block', minWidth: ancha ? 52 : 28, textAlign: 'center', px: 1.25, py: 0.25, borderRadius: '20px', fontWeight: 600, bgcolor: fondo, color: texto }}>
      {children}
    </Box>
  );
}
