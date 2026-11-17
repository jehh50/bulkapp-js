/**
 * Cliente HTTP de la API. El token de acceso vive solo en memoria; la cookie de
 * refresco (httpOnly) permite renovarlo. Con actividad se renueva antes de
 * vencer, de modo que la sesión solo caduca por inactividad.
 */
import type { ErrorRespuesta, SesionRespuesta } from '@bulkapp/shared';

const BASE = '/api/v1';

/** Error de la API con el mensaje que el servidor decidió mostrar. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly errores: Record<string, string> | string[] | undefined;
  readonly datos: Record<string, unknown>;

  constructor(status: number, cuerpo: Partial<ErrorRespuesta> & Record<string, unknown>) {
    super(typeof cuerpo.message === 'string' ? cuerpo.message : 'No se pudo completar la operación.');
    this.status = status;
    this.code = cuerpo.code;
    this.errores = cuerpo.errores;
    this.datos = cuerpo;
  }

  /** Errores por campo (vacío si el servidor envió una lista o nada). */
  get porCampo(): Record<string, string> {
    return this.errores && !Array.isArray(this.errores) ? this.errores : {};
  }
}

export const mensajeDe = (e: unknown): string => (e instanceof Error ? e.message : 'No se pudo completar la operación.');

type Parametros = Record<string, string | number | boolean | null | undefined>;
type Oyente = (sesion: SesionRespuesta | null) => void;

let token: string | null = null;
let emitidoEn = 0;
let vidaMs = 0;
let refresco: Promise<SesionRespuesta | null> | null = null;
let oyente: Oyente = () => {};

/** La sesión (AuthProvider) se entera de cada renovación o expiración. */
export function alCambiarSesion(fn: Oyente): void {
  oyente = fn;
}

export function fijarSesion(sesion: SesionRespuesta | null): void {
  token = sesion?.accessToken ?? null;
  emitidoEn = Date.now();
  vidaMs = (sesion?.expiresIn ?? 0) * 1000;
}

function url(ruta: string, params?: Parametros): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v !== null && v !== undefined && v !== '') q.set(k, String(v));
  const cadena = q.toString();
  return `${BASE}${ruta}${cadena ? `?${cadena}` : ''}`;
}

async function leerError(res: Response): Promise<ApiError> {
  let cuerpo: Record<string, unknown> = {};
  try {
    cuerpo = (await res.json()) as Record<string, unknown>;
  } catch {
    cuerpo = {};
  }
  return new ApiError(res.status, cuerpo);
}

/** Renueva los tokens con la cookie de refresco (una sola petición a la vez). */
export function renovarSesion(): Promise<SesionRespuesta | null> {
  refresco ??= (async () => {
    try {
      const res = await fetch(url('/auth/refresh'), { method: 'POST', credentials: 'include' });
      const sesion = res.ok ? ((await res.json()) as SesionRespuesta) : null;
      fijarSesion(sesion);
      oyente(sesion);
      return sesion;
    } catch {
      return null;
    } finally {
      refresco = null;
    }
  })();
  return refresco;
}

interface Opciones {
  params?: Parametros;
  body?: unknown;
  /** Rutas públicas de autenticación: sin token ni reintento. */
  publica?: boolean;
}

async function enviar(metodo: string, ruta: string, o: Opciones = {}): Promise<Response> {
  // Con actividad, renueva al consumir un tercio de la vida del token.
  if (!o.publica && token !== null && Date.now() - emitidoEn > vidaMs / 3) await renovarSesion();

  const ejecutar = (): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (!o.publica && token !== null) headers.Authorization = `Bearer ${token}`;
    let body: BodyInit | undefined;
    if (o.body instanceof FormData) body = o.body;
    else if (o.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(o.body);
    }
    return fetch(url(ruta, o.params), { method: metodo, headers, body, credentials: 'include' });
  };

  let res = await ejecutar();
  if (res.status === 401 && !o.publica) {
    if ((await renovarSesion()) !== null) res = await ejecutar();
    else oyente(null);
  }
  if (!res.ok) throw await leerError(res);
  return res;
}

async function json<T>(metodo: string, ruta: string, o?: Opciones): Promise<T> {
  const res = await enviar(metodo, ruta, o);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Guarda en disco una respuesta de archivo, con el nombre que indica el servidor. */
async function descargar(ruta: string, params?: Parametros): Promise<void> {
  const res = await enviar('GET', ruta, { params });
  const nombre = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'descarga';
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(await res.blob());
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}

export const api = {
  get: <T>(ruta: string, params?: Parametros) => json<T>('GET', ruta, { params }),
  post: <T = void>(ruta: string, body?: unknown, o?: Pick<Opciones, 'publica'>) => json<T>('POST', ruta, { body, ...o }),
  put: <T = void>(ruta: string, body?: unknown) => json<T>('PUT', ruta, { body }),
  patch: <T = void>(ruta: string, body?: unknown) => json<T>('PATCH', ruta, { body }),
  delete: <T = void>(ruta: string) => json<T>('DELETE', ruta),
  descargar,
};
