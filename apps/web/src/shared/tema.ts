/**
 * Tema de Material UI alineado con la interfaz PHP (layout `nheader.php`):
 * Poppins, navbar azul 900, hero azul 700, acento dorado y tarjetas blancas
 * redondeadas sobre fondo gris claro.
 */
import { createTheme } from '@mui/material';
import { esES } from '@mui/material/locale';

/** Paleta de marca (variables `--blue-*`, `--gold`, etc. del proyecto PHP). */
export const MARCA = {
  azul900: '#12306b',
  azul700: '#1a4391',
  azul600: '#2d57a8',
  azul500: '#2f5fc4',
  dorado: '#f5b83d',
  doradoHover: '#e9a924',
  fondo: '#f4f6fa',
  tinta: '#252525',
  tenue: '#c9d6f0',
  linea: '#eef0f4',
  cabeceraTabla: '#f1f4fa',
  verde: '#0f9d75',
  morado: '#6f42c1',
} as const;

/** Colores de series para gráficas (los mismos del dashboard PHP). */
export const COLORES_GRAFICA = ['#12306b', '#8a3fb0', '#0b7a5c', '#b8470f', '#0e7490', '#b4235a'];

/** Sombras de las tarjetas PHP: `.data-card` (suave) y `.filter-card` (elevada). */
export const SOMBRA = {
  tarjeta: '0 1px 3px rgba(16,24,40,.08)',
  elevada: '0 8px 24px rgba(18,48,107,.12)',
} as const;

const etiquetaMayuscula = { fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' } as const;

export const tema = createTheme({
  palette: {
    primary: { main: MARCA.azul700, dark: MARCA.azul900, light: MARCA.azul500 },
    secondary: { main: MARCA.dorado, dark: MARCA.doradoHover, contrastText: MARCA.tinta },
    success: { main: MARCA.verde },
    background: { default: MARCA.fondo, paper: '#fff' },
    text: { primary: MARCA.tinta, secondary: '#6b7280' },
    divider: MARCA.linea,
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: 'Poppins, system-ui, sans-serif',
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 600, fontSize: 16 },
    button: { textTransform: 'none', fontWeight: 600 },
    overline: { ...etiquetaMayuscula, lineHeight: 1.5 },
  },
  components: {
    MuiCssBaseline: { styleOverrides: { body: { color: MARCA.tinta } } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 10 },
        // `.btn-outline-primary` de botones.css: fondo blanco, borde y texto azul.
        outlinedPrimary: {
          backgroundColor: '#fff',
          borderColor: MARCA.azul700,
          '&:hover': { backgroundColor: MARCA.azul700, borderColor: MARCA.azul700, color: '#fff' },
        },
        containedPrimary: { '&:hover': { backgroundColor: MARCA.azul900 } },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: 16 },
        // Las tarjetas de la app no llevan borde: sombra suave como `.data-card`.
        outlined: { border: 0, boxShadow: SOMBRA.tarjeta },
      },
    },
    MuiAccordion: {
      styleOverrides: { root: { '&.MuiPaper-outlined': { border: `1px solid ${MARCA.linea}`, boxShadow: 'none' } } },
    },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 16 } } },
    MuiDialogTitle: { styleOverrides: { root: { fontWeight: 600 } } },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: '#fff',
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: MARCA.azul700 },
          '&.Mui-focused': { boxShadow: '0 0 0 .2rem rgba(47,95,196,.2)' },
        },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { fontWeight: 500 } } },
    // Tablas con el aspecto de `.data-table`.
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: 0, borderTop: `1px solid ${MARCA.linea}`, padding: '12px' },
        sizeSmall: { padding: '10px 12px' },
        head: {
          ...etiquetaMayuscula,
          fontSize: 11.5,
          color: MARCA.tinta,
          whiteSpace: 'nowrap',
          backgroundColor: MARCA.cabeceraTabla,
          borderTop: 0,
        },
        stickyHeader: { backgroundColor: MARCA.cabeceraTabla, boxShadow: '0 1px 0 #dfe5f2' },
        footer: { backgroundColor: MARCA.azul900, color: '#fff', fontWeight: 600, fontSize: 14, borderTop: 0 },
      },
    },
    MuiTableRow: { styleOverrides: { hover: { '&:hover': { backgroundColor: '#fafbfe !important' } } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600, borderRadius: 20 } } },
    MuiTabs: { styleOverrides: { indicator: { backgroundColor: MARCA.dorado, height: 3 } } },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } } },
    MuiPaginationItem: { styleOverrides: { root: { borderRadius: 8 } } },
    MuiMenu: { styleOverrides: { paper: { borderRadius: 12 } } },
    MuiMenuItem: { styleOverrides: { root: { borderRadius: 8, margin: '0 6px' } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 12 } } },
  },
}, esES);
