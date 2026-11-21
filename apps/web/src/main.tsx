import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Rutas } from './routes/Rutas.tsx';
import { ApiError } from './shared/api.ts';
import { AuthProvider } from './shared/auth.tsx';
import { tema } from './shared/tema.ts';
import { AvisosProvider } from './shared/ui.tsx';

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
