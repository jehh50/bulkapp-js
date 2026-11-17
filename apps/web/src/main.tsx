import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { esES } from '@mui/material/locale';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Rutas } from './routes/Rutas.tsx';
import { ApiError } from './shared/api.ts';
import { AuthProvider } from './shared/auth.tsx';
import { AvisosProvider } from './shared/ui.tsx';

/** Colores de marca heredados de la interfaz anterior. */
export const MARCA = { azul900: '#12306b', azul700: '#1a4391', dorado: '#f5b83d', verde: '#0f9d75' } as const;

const tema = createTheme({
  palette: {
    primary: { main: MARCA.azul700, dark: MARCA.azul900 },
    secondary: { main: MARCA.dorado, contrastText: '#252525' },
    success: { main: MARCA.verde },
    background: { default: '#f4f6fa' },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: 'system-ui, "Segoe UI", Roboto, sans-serif',
    h5: { fontWeight: 600 },
    subtitle1: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiTableCell: { styleOverrides: { head: { fontWeight: 600, whiteSpace: 'nowrap' } } },
    MuiTextField: { defaultProps: { size: 'small' } },
  },
}, esES);

const consultas = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Los errores del cliente (validación, permisos) no mejoran reintentando.
      retry: (intentos, error) => !(error instanceof ApiError && error.status < 500) && intentos < 2,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={tema}>
      <CssBaseline />
      <QueryClientProvider client={consultas}>
        <AvisosProvider>
          <AuthProvider>
            <BrowserRouter>
              <Rutas />
            </BrowserRouter>
          </AuthProvider>
        </AvisosProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
