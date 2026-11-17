/**
 * Sesión del usuario: restaura con la cookie de refresco al cargar, y expone
 * login, logout y cambio de campaña.
 */
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ROL, type Rol, type SesionRespuesta, type UsuarioSesion } from '@bulkapp/shared';
import { alCambiarSesion, api, fijarSesion, renovarSesion } from './api.ts';

type Estado =
  | { fase: 'cargando' }
  | { fase: 'anonimo' }
  | { fase: 'autenticado'; usuario: UsuarioSesion };

interface Sesion {
  estado: Estado;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  cambiarCampana: (servicioId: number) => Promise<void>;
}

const SesionContext = createContext<Sesion | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' });
  const cache = useQueryClient();

  const aplicar = useCallback((sesion: SesionRespuesta | null) => {
    setEstado(sesion ? { fase: 'autenticado', usuario: sesion.usuario } : { fase: 'anonimo' });
  }, []);

  useEffect(() => {
    alCambiarSesion(aplicar);
    void renovarSesion().then(aplicar);
    return () => alCambiarSesion(() => {});
  }, [aplicar]);

  const valor = useMemo<Sesion>(() => {
    const abrir = (sesion: SesionRespuesta | null) => {
      fijarSesion(sesion);
      cache.clear();
      aplicar(sesion);
    };
    return {
      estado,
      login: async (username, password) => abrir(await api.post<SesionRespuesta>('/auth/login', { username, password }, { publica: true })),
      logout: async () => {
        try {
          await api.post('/auth/logout', undefined, { publica: true });
        } finally {
          abrir(null);
        }
      },
      cambiarCampana: async (servicioId) => abrir(await api.post<SesionRespuesta>('/auth/campana', { servicio_id: servicioId })),
    };
  }, [estado, aplicar, cache]);

  return <SesionContext value={valor}>{children}</SesionContext>;
}

export function useSesion(): Sesion {
  const sesion = use(SesionContext);
  if (!sesion) throw new Error('useSesion debe usarse dentro de <AuthProvider>.');
  return sesion;
}

/** Usuario de una pantalla protegida (las guardas de ruta garantizan que existe). */
export function useUsuario(): UsuarioSesion {
  const { estado } = useSesion();
  if (estado.fase !== 'autenticado') throw new Error('Pantalla protegida sin sesión.');
  return estado.usuario;
}

export const esSupervision = (rol: Rol): boolean => rol === ROL.SUPERVISOR || rol === ROL.ADMINISTRADOR;
export const esAdmin = (rol: Rol): boolean => rol === ROL.ADMINISTRADOR;
