/** Contratos de la API compartidos con la web. */
import type { Flujo, Rol } from './constants.ts';

export interface CampanaSesion {
  id: number;
  etiqueta: string;
  tipo_flujo: Flujo;
}

export interface UsuarioSesion {
  id: number;
  username: string;
  nombre: string;
  apellido: string;
  rol: Rol;
  /** Campaña activa de la sesión. */
  servicioId: number;
  tipoFlujo: Flujo;
  campanas: CampanaSesion[];
}

export interface SesionRespuesta {
  accessToken: string;
  /** Segundos de vida del token de acceso. */
  expiresIn: number;
  usuario: UsuarioSesion;
}

export interface ErrorRespuesta {
  message: string;
  errores?: Record<string, string> | string[];
  code?: string;
}
