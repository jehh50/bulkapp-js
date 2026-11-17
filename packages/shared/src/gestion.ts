/**
 * Registro de gestión / venta del formulario bancario (docs/nodejs-react.md §4.1).
 * Funciones puras: arman y validan los datos; la escritura vive en la API.
 */
import { CUENTA_POR_DEFECTO, EFECTIVO_VENTA_ID, ESTADO, GENEROS, NACIONALIDADES } from './constants.ts';
import {
  inputDate, inputDigits, inputEmail, inputEnum, inputInt, inputLetters, inputPan, inputPhone, inputString,
} from './input.ts';

export interface VentaDatos {
  nombre: string;
  apellido: string;
  genero: 'M' | 'F';
  /** AAAA-MM-DD */
  fecha_nac: string;
  cedula: string;
  correo: string;
  telf_hab: string;
  telf_cel: string;
  estado: number;
  ciudad: number;
  municipio: number;
  nacionalidad: number;
  tipo_cuenta: number;
  cuenta: string;
  observaciones: string;
}

export interface GestionDatos {
  id_cliente: number;
  contacto: 0 | 1;
  efectivo: number | null;
  noefectivo: number | null;
  sub_contacto: number | null;
  producto: number | null;
  status: number;
  esVenta: boolean;
  venta: VentaDatos | null;
}

export type ResultadoGestion =
  | { ok: true; datos: GestionDatos }
  | { ok: false; errores: Record<string, string> };

/** Acepta `dd-mm-aaaa` o `aaaa-mm-dd` y devuelve `aaaa-mm-dd` (o null). */
export function normalizarFechaNacimiento(valor: unknown): string | null {
  const v = inputString(valor, 10);
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(v);
  return inputDate(m ? `${m[3]}-${m[2]}-${m[1]}` : v);
}

export function validarVenta(entrada: Record<string, unknown>): { errores: Record<string, string>; venta: VentaDatos | null } {
  const errores: Record<string, string> = {};
  const nombre = inputLetters(entrada.nombre, 60);
  const apellido = inputLetters(entrada.apellido, 60);
  const genero = inputEnum(entrada.genero, GENEROS);
  const fechaNac = normalizarFechaNacimiento(entrada.fecha_nac);
  const cedula = inputDigits(entrada.cedula, 10);
  const correo = inputEmail(entrada.correo, 150);
  const telfHab = inputPhone(entrada.telf_hab);
  const telfCel = inputPhone(entrada.telf_cel);
  const estado = inputInt(entrada.estado, 1);
  const ciudad = inputInt(entrada.ciudad, 1);
  const municipio = inputInt(entrada.municipio, 1);
  const nacionalidad = inputEnum(entrada.nacionalidad, NACIONALIDADES);
  const tipoCuenta = inputInt(entrada.tipo_cuenta, 1);
  const cuenta = entrada.pan === undefined || entrada.pan === null || entrada.pan === '' ? CUENTA_POR_DEFECTO : inputPan(entrada.pan);

  if (nombre === '') errores.nombre = 'Ingresa el nombre (solo letras).';
  if (apellido === '') errores.apellido = 'Ingresa el apellido (solo letras).';
  if (genero === null) errores.genero = 'Selecciona el género.';
  if (fechaNac === null) errores.fecha_nac = 'Fecha de nacimiento inválida.';
  if (cedula === '') errores.cedula = 'Ingresa la cédula (solo dígitos).';
  if (correo === null) errores.correo = 'Correo inválido.';
  if (telfHab === null) errores.telf_hab = 'Teléfono de habitación inválido.';
  if (telfCel === null) errores.telf_cel = 'Teléfono celular inválido.';
  if (estado === null) errores.estado = 'Selecciona el estado.';
  if (ciudad === null) errores.ciudad = 'Selecciona la ciudad.';
  if (municipio === null) errores.municipio = 'Selecciona el municipio.';
  if (nacionalidad === null) errores.nacionalidad = 'Selecciona la nacionalidad.';
  if (tipoCuenta === null) errores.tipo_cuenta = 'Selecciona el tipo de cuenta.';
  if (cuenta === null) errores.pan = 'El número de cuenta admite hasta 20 dígitos.';

  if (Object.keys(errores).length > 0) return { errores, venta: null };
  return {
    errores,
    venta: {
      nombre, apellido, genero: genero!, fecha_nac: fechaNac!, cedula, correo: correo!, telf_hab: telfHab!,
      telf_cel: telfCel!, estado: estado!, ciudad: ciudad!, municipio: municipio!, nacionalidad: nacionalidad!,
      tipo_cuenta: tipoCuenta!, cuenta: cuenta!, observaciones: inputString(entrada.observaciones, 250),
    },
  };
}

/**
 * Datos de la gestión. Estado resultante:
 *  - `noefectivo` → 3 (No efectivo); `efectivo` sin venta → 4 (Efectivo);
 *  - venta (efectivo = «Gestión efectiva») → 7 (Atendido).
 */
export function validarGestion(entrada: Record<string, unknown>): ResultadoGestion {
  const errores: Record<string, string> = {};
  const idCliente = inputInt(entrada.id_cliente, 1);
  const contacto = inputInt(entrada.contacto, 0, 1);
  if (idCliente === null) errores.id_cliente = 'Busca un cliente antes de registrar.';
  if (contacto === null) errores.contacto = 'Indica si hubo contacto.';

  const efectivo = entrada.efectivo === undefined || entrada.efectivo === null || entrada.efectivo === '' ? null : inputInt(entrada.efectivo, 0);
  const noefectivo = entrada.noefectivo === undefined || entrada.noefectivo === null || entrada.noefectivo === '' ? null : inputInt(entrada.noefectivo, 0);
  if (efectivo === null && noefectivo === null) errores.efectivo = 'Selecciona el resultado de la llamada.';

  const esVenta = efectivo === EFECTIVO_VENTA_ID;
  const producto = entrada.producto === undefined || entrada.producto === null || entrada.producto === '' ? null : inputInt(entrada.producto, 1);
  let venta: VentaDatos | null = null;
  if (esVenta) {
    const v = validarVenta(entrada);
    Object.assign(errores, v.errores);
    venta = v.venta;
    if (producto === null) errores.producto = 'Selecciona el producto vendido.';
  }

  if (Object.keys(errores).length > 0 || idCliente === null || contacto === null) return { ok: false, errores };

  const status = esVenta ? ESTADO.ATENDIDO : noefectivo !== null ? ESTADO.NO_EFECTIVO : ESTADO.EFECTIVO;
  return {
    ok: true,
    datos: {
      id_cliente: idCliente,
      contacto: contacto as 0 | 1,
      efectivo,
      noefectivo,
      sub_contacto: entrada.sub_contacto === undefined || entrada.sub_contacto === null || entrada.sub_contacto === '' ? null : inputInt(entrada.sub_contacto, 0),
      producto,
      status,
      esVenta,
      venta,
    },
  };
}
