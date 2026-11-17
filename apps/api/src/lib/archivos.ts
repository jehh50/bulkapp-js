/**
 * Subida y lectura de archivos tabulares (CSV / TXT / XLSX) y escritura de XLSX.
 */
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import multer from 'multer';
import { HttpError } from './core.ts';

export interface Tabla { headers: string[]; filas: string[][] }

/** Subida en memoria con límite de tamaño (un solo archivo, campo `archivo`). */
export function subida(maxBytes: number) {
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxBytes, files: 1 } }).single('archivo');
  return (req: Parameters<typeof upload>[0], res: Parameters<typeof upload>[1], next: Parameters<typeof upload>[2]) => {
    upload(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        next(new HttpError(422, err.code === 'LIMIT_FILE_SIZE' ? 'El archivo excede el tamaño permitido.' : 'La carga del archivo falló.'));
        return;
      }
      next(err);
    });
  };
}

/** Valida extensión y contenido. Devuelve la extensión normalizada. */
export function validarArchivo(archivo: Express.Multer.File | undefined, extensiones: readonly string[]): string {
  if (!archivo) throw new HttpError(422, 'No se recibió el archivo.');
  if (archivo.size <= 0) throw new HttpError(422, 'El archivo está vacío.');
  const ext = path.extname(archivo.originalname).slice(1).toLowerCase();
  if (!extensiones.includes(ext)) throw new HttpError(422, `Solo se permiten archivos ${extensiones.map((e) => e.toUpperCase()).join(', ')}.`);

  const esZip = archivo.buffer.subarray(0, 2).toString('latin1') === 'PK';
  if (ext === 'xlsx' ? !esZip : esZip || archivo.buffer.subarray(0, 4096).includes(0)) {
    throw new HttpError(422, 'El contenido del archivo no corresponde a la extensión.');
  }
  return ext;
}

/** Decodifica como UTF-8 y, si no es válido, como ISO-8859-1. */
function decodificar(buffer: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('latin1').decode(buffer);
  }
}

const limpiarHeaders = (headers: string[]): string[] => headers.map((h) => h.replace(/^﻿/, '').trim());

function aTabla(filas: string[][]): Tabla {
  const utiles = filas.filter((f) => f.some((c) => c.trim() !== ''));
  if (utiles.length === 0) return { headers: [], filas: [] };
  return { headers: limpiarHeaders(utiles[0]!), filas: utiles.slice(1) };
}

/** CSV: detecta codificación y delimitador (`;` o `,`, o el indicado). */
export function parsearCsv(buffer: Buffer, delimitador?: string): Tabla | null {
  const texto = decodificar(buffer);
  const primera = texto.split(/\r?\n/, 1)[0] ?? '';
  const delim = delimitador ?? ((primera.split(';').length >= primera.split(',').length) ? ';' : ',');
  try {
    const filas = parse(texto, { delimiter: delim, bom: true, relax_column_count: true, relax_quotes: true, skip_empty_lines: true }) as string[][];
    return aTabla(filas.map((f) => f.map((c) => c ?? '')));
  } catch {
    return null;
  }
}

/** XLSX: primera hoja, respetando huecos de columna. */
export async function parsearXlsx(buffer: Buffer): Promise<Tabla | null> {
  try {
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(buffer as unknown as ArrayBuffer);
    const hoja = libro.worksheets[0];
    if (!hoja) return null;
    const filas: string[][] = [];
    hoja.eachRow({ includeEmpty: false }, (fila) => {
      const celdas: string[] = [];
      for (let c = 1; c <= fila.cellCount; c++) celdas.push(String(fila.getCell(c).text ?? ''));
      filas.push(celdas);
    });
    return aTabla(filas);
  } catch {
    return null;
  }
}

export async function parsearArchivo(archivo: Express.Multer.File, ext: string): Promise<Tabla | null> {
  return ext === 'xlsx' ? parsearXlsx(archivo.buffer) : parsearCsv(archivo.buffer);
}

// --- Escritura XLSX -----------------------------------------------------------

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const relleno = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
/** Estilos de encabezado por grupo: datos del envío, datos de la búsqueda, campos del formulario. */
export const ESTILO_ENCABEZADO: Array<Partial<ExcelJS.Style>> = [
  { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: relleno('FF12306B') },
  { font: { bold: true, color: { argb: 'FF252525' } }, fill: relleno('FFF5B83D') },
  { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: relleno('FF0F9D75') },
];

export function aplicarEstilo(celda: ExcelJS.Cell, estilo: Partial<ExcelJS.Style>): void {
  if (estilo.font) celda.font = estilo.font;
  if (estilo.fill) celda.fill = estilo.fill;
}

/** Ancho de columna a partir de su título. */
export const anchoColumna = (titulo: string): number => Math.max(12, Math.min(40, Array.from(titulo).length + 4));

export { ExcelJS };
