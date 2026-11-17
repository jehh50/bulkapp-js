/**
 * Constantes del dominio de BulkApp, compartidas por la API y la web.
 * Equivalen a la clase `Constantes` del código PHP de origen: ningún literal de
 * negocio (rol, estado, flujo) se escribe fuera de este módulo.
 */

/** Tipos de usuario (`usertypes.id`). */
export const ROL = {
  OPERADOR: 1,
  SUPERVISOR: 2,
  ADMINISTRADOR: 3,
} as const;
export type Rol = (typeof ROL)[keyof typeof ROL];

export const ROLES: readonly Rol[] = [ROL.OPERADOR, ROL.SUPERVISOR, ROL.ADMINISTRADOR];
export const ROLES_SUPERVISION: readonly Rol[] = [ROL.SUPERVISOR, ROL.ADMINISTRADOR];
export const ROLES_ADMIN: readonly Rol[] = [ROL.ADMINISTRADOR];

export const ROL_NOMBRE: Record<number, string> = {
  [ROL.OPERADOR]: 'Operador',
  [ROL.SUPERVISOR]: 'Supervisor',
  [ROL.ADMINISTRADOR]: 'Administrador',
};

/** Estado de un registro de catálogo (usuarios, campañas, productos, formularios). */
export const REGISTRO = {
  INACTIVO: 1,
  ACTIVO: 2,
} as const;

/** Estados del cliente y de la gestión (`status_id`). */
export const ESTADO = {
  /** Cliente sin contactar / gestión no efectiva. */
  NO_EFECTIVO: 3,
  /** Cliente contactado / gestión efectiva sin venta. */
  EFECTIVO: 4,
  /** Cliente atendido: ya tiene una venta. */
  ATENDIDO: 7,
} as const;

/** Estado al que vuelve un cliente desbloqueado (sin contactar). */
export const ESTADO_SIN_CONTACTAR = ESTADO.NO_EFECTIVO;

/** Tipos de flujo de una campaña (`servicios.tipo_flujo`). */
export const FLUJO = {
  BANCARIO: 'bancario',
  DINAMICO: 'dinamico',
} as const;
export type Flujo = (typeof FLUJO)[keyof typeof FLUJO];
export const FLUJOS: readonly Flujo[] = [FLUJO.BANCARIO, FLUJO.DINAMICO];

/** Campaña bancaria base (Banco Activo): dueña de los catálogos de banca. */
export const SERVICIO_BANCARIO_BASE = 1;

/** Id del contacto efectivo que representa una venta («Gestión efectiva»). */
export const EFECTIVO_VENTA_ID = 1;
/** Descripción del contacto efectivo que marca la venta en los reportes. */
export const EFECTIVO_VENTA_DESCRIPCION = 'gestión efectiva';

/** Número de cuenta que se guarda cuando el operador no lo captura. */
export const CUENTA_POR_DEFECTO = '00000000000000000000';
export const NACIONALIDADES = [1, 2, 3] as const;
export const NACIONALIDAD_NOMBRE: Record<number, string> = { 1: 'Venezolano', 2: 'Extranjero', 3: 'Pasaporte' };
export const GENEROS = ['M', 'F'] as const;
export const TIPO_GESTION_POR_DEFECTO = 'telefonica';

/** Constructor de formularios dinámicos. */
export const TIPOS_CAMPO = ['text', 'textarea', 'number', 'date', 'email', 'select', 'nested'] as const;
export type TipoCampo = (typeof TIPOS_CAMPO)[number];
export const TRANSFORMACION = {
  MAYUSCULAS: 'mayusculas',
  TELEFONO: 'telefono',
} as const;
export const TRANSFORMACIONES: readonly string[] = [TRANSFORMACION.MAYUSCULAS, TRANSFORMACION.TELEFONO];
/** Longitud máxima aceptada para un valor de texto capturado. */
export const CAPTURA_MAX_VALOR = 2000;

/** Reporte de formularios dinámicos. */
export const REPORTE_FILAS_POR_PAGINA = [10, 25, 50, 100] as const;
export const REPORTE_FILAS_POR_DEFECTO = 25;
export const REPORTE_TANDA_EXPORTACION = 1000;

/** Cargas masivas. */
export const CARGA_LOTE_CLIENTES = 1000;
export const CARGA_LOTE_FILAS_FORMULARIO = 500;
export const CARGA_MAX_BYTES_CLIENTES = 10 * 1024 * 1024;
export const CARGA_MAX_BYTES_FORMULARIO = 20 * 1024 * 1024;
export const CARGA_COLUMNAS_CLIENTES = [
  'identificacion', 'nombre_legal', 'telf_hab', 'telf_ofi', 'telf_cel', 'correo', 'direccion', 'cuenta', 'oferta',
] as const;

/** Contraseñas. */
export const PASSWORD_MIN = 8;
export const PASSWORDS_PROHIBIDAS: readonly string[] = ['123456', '12345678'];

/** XML de ventas (sistema externo): valores fijos del emisor. */
export const XML = {
  COMPANY_NAME: 'CORPF1',
  AGENCY_CODE: '804',
  AGENCY_NAME: 'CARACAS',
  CHANNEL_CODE: '20',
  PAYMENT_TYPE: 'AC',
  TELEFONO_OFICINA_VACIO: '(0000)000.00.00',
  SELLER_DOCUMENT: '505658514',
  CERTIFICATE_LENGTH: 19,
} as const;

/** Separador visual entre empresa y campaña. */
export const CAMPANAS_SEPARADOR = ' › ';
