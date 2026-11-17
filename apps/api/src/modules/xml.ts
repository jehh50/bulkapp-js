/**
 * XML de ventas para el sistema externo (bulk_sales). Reproduce el documento que
 * generaba PHP. Cada transacción consume un número correlativo de `transacciones`
 * (secuencia viva: no reiniciar; ver docs/nodejs-react.md §5.6).
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { FLUJO, REGISTRO, XML, inputDate, inputInt } from '@bulkapp/shared';
import { env } from '../config/env.ts';
import { listarCampanas } from '../lib/campanas.ts';
import { compacta, deFechaDb, horaActual, hoy, invalido, logger, noEncontrado, prisma, sumarMeses } from '../lib/core.ts';
import { sesionDe } from '../middleware/auth.ts';

export const xmlRouter = Router();

const DIR_XML = path.join(env.storageDir, 'xml');
const ARCHIVO_VALIDO = /^[0-9]{8,14}_(bulk_sales\.xml|MD5SUM)$|^MD5SUM$/;

/** Carpeta de una campaña: su nombre en minúsculas, sin espacios ni caracteres de ruta. */
const carpetaDe = (nombre: string): string => nombre.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9_-]/g, '');

const esc = (v: unknown): string => String(v ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');

interface VentaXml {
  id_resultado: number; codigo_producto: string | null; costo_prod: string | null; codplan: string; nombre: string; apellido: string;
  nacionalidad: string; fecha_nacimiento: Date | null; genero: string; cedula: string; telf_hab: string; telf_ofi: string | null;
  telf_celular: string; correo: string; cuenta: string; cod_cuenta: number | null; nombre_cuenta: string | null; estado: string;
  codigo_estado: number; ciudad: string; codigo_ciudad: string; municipio: string; codigo_municipio: string; company_code: string;
  nombre_servicio: string;
}

const direccion = (v: VentaXml, recortar: boolean): string => `
                        <address>
                          <country_code>1</country_code>
                          <country_name>VENEZUELA</country_name>
                          <state_code>${esc(v.codigo_estado)}</state_code>
                          <state_name>${esc(v.estado.trimEnd())}</state_name>
                          <city_code>${esc(v.codigo_ciudad)}</city_code>
                          <city_name>${esc(recortar ? v.ciudad.trimEnd() : v.ciudad)}</city_name>
                          <municipality_code>${esc(v.codigo_municipio)}</municipality_code>
                          <municipality_name>${esc(recortar ? v.municipio.trimEnd() : v.municipio)}</municipality_name>
                          <parish></parish>
                          <zip_code></zip_code>
                          <street></street>
                          <estate></estate>
                          <building></building>
                          <floor></floor>
                          <number></number>
                        </address>`;

/** Bloque <person> (titular, tomador y pagador comparten estructura). */
function persona(v: VentaXml, o: { documento: string; recortar: boolean; fechaVenta: string; fechaProceso: string; nacimiento: string }): string {
  const oficina = v.telf_ofi ? v.telf_ofi : XML.TELEFONO_OFICINA_VACIO;
  return `
                      <person>
                        <name>${esc(v.nombre)}</name>
                        <document_type_code>${esc(o.documento)}</document_type_code>
                        <document_number>${esc(v.cedula)}</document_number>${direccion(v, o.recortar)}
                        <issue_date>${o.fechaVenta}</issue_date>
                        <type_person type="N">
                          <natural_person>
                            <last_name>${esc(v.apellido)}</last_name>
                            <last_update_date>${o.fechaProceso}</last_update_date>
                            <education_degree_code/>
                            <education_degree_name/>
                            <occuppation_code>125</occuppation_code>
                            <occuppation_name>URBANISTA</occuppation_name>
                            <birthdate>${o.nacimiento}</birthdate>
                            <gender>${esc(v.genero)}</gender>
                            <marital_status>S</marital_status>
                            <children_number>0</children_number>
                            <email>${esc(v.correo)}</email>
                            <home_telephone1>${esc(v.telf_hab)}</home_telephone1>
                            <cellular_phone>${esc(v.telf_celular)}</cellular_phone>
                            <company_name/>
                            <position/>
                            <income_amount>0</income_amount>
                            <office_telephone1>${esc(oficina)}</office_telephone1>
                          </natural_person>
                        </type_person>
                      </person>`;
}

function transaccion(v: VentaXml, k: number, fechaVenta: string, fechaProceso: string): string {
  const o = {
    fechaVenta, fechaProceso, recortar: true, documento: v.nacionalidad,
    nacimiento: v.fecha_nacimiento ? compacta(deFechaDb(v.fecha_nacimiento)) : '',
  };
  const certificado = String(k).padStart(XML.CERTIFICATE_LENGTH - String(k).length, '0');
  const finRecibo = compacta(sumarMeses(`${fechaVenta.slice(0, 4)}-${fechaVenta.slice(4, 6)}-${fechaVenta.slice(6, 8)}`, 1));
  return `
                <transaction id="${k}">
                  <type_code>E</type_code>
                  <policy>
                    <call_id>${k}</call_id>
                    <certificate_number>${certificado}</certificate_number>
                    <product_code>${esc(v.codigo_producto)}</product_code>
                    <plan_code>${esc(v.codplan)}</plan_code>
                    <issue_date>${fechaVenta}</issue_date>
                    <channel_code>${XML.CHANNEL_CODE}</channel_code>
                    <company_user/>
                    <simm_user/>
                    <currency_type>0</currency_type>
                    <frequency_code>2</frequency_code>
                    <policy_holder>${persona(v, o)}
                    </policy_holder>
                    <policy_taker>${persona(v, o)}
                    </policy_taker>
                    <policy_payer>${persona(v, { ...o, documento: '1', recortar: false })}
                      <payment_mean>
                        <payment_mean_code>${esc(v.cod_cuenta)}</payment_mean_code>
                        <payment_mean_name>${esc(v.nombre_cuenta)}</payment_mean_name>
                        <payment_type type="${XML.PAYMENT_TYPE}">
                        <account>
                        <number>${esc(v.cuenta)}</number>
                        </account>
                        </payment_type>
                      </payment_mean>
                    </policy_payer>
                    <beneficiaries/>
                    <policy_sellers>
                      <policy_seller type="V">
                        <document_type_code>1</document_type_code>
                        <document_number>${XML.SELLER_DOCUMENT}</document_number>
                        <name>CALL</name>
                        <last_name>CENTER</last_name>
                        <position_code>40</position_code>
                        <position>OPERADOR DE TLMK</position>
                      </policy_seller>
                    </policy_sellers>
                    <receipt>
                      <external_id>${k}</external_id>
                      <begin_date>${fechaVenta}</begin_date>
                      <end_date>${finRecibo}</end_date>
                      <total_amount>${esc(v.costo_prod)}</total_amount>
                      <payment>
                        <payment_mean_number>${esc(v.cuenta)}</payment_mean_number>
                        <insurance_account_number/>
                        <insurance_comission>0</insurance_comission>
                        <insurance_amount>0</insurance_amount>
                        <insurance_debit_transaction>0</insurance_debit_transaction>
                        <insurance_credit_transaction>0</insurance_credit_transaction>
                        <bank_account_number>0</bank_account_number>
                        <bank_comission>0</bank_comission>
                        <bank_amount>0</bank_amount>
                        <bank_ins_debit_transaction>0</bank_ins_debit_transaction>
                        <bank_credit_transaction>0</bank_credit_transaction>
                        <reinsurance_account_number>0</reinsurance_account_number>
                        <reinsurance_comission>0</reinsurance_comission>
                        <reinsurance_amount>0</reinsurance_amount>
                        <reinsurance_ins_debit_transaction>0</reinsurance_ins_debit_transaction>
                        <reinsurance_credit_transaction>0</reinsurance_credit_transaction>
                        <simm_account_number>0</simm_account_number>
                        <simm_comission>0</simm_comission>
                        <simm_amount>0</simm_amount>
                        <simm_ins_debit_transaction>0</simm_ins_debit_transaction>
                        <simm_credit_transaction>0</simm_credit_transaction>
                      </payment>
                    </receipt>
                  </policy>
                </transaction>`;
}

/** Arma el documento completo. `k` es el primer número de transacción. */
export function construirXml(ventas: VentaXml[], k: number, fechaVenta: string, fechaProceso: string): string {
  const encabezado = `<bulk_sales xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="bulk_sales.xsd">
    <company code="${esc(ventas[0]?.company_code)}">
      <company_name>${XML.COMPANY_NAME}</company_name>
        <agencies>
          <agency code="${XML.AGENCY_CODE}">
            <agency_name>${XML.AGENCY_NAME}</agency_name>
              <transactions>`;
  const fin = `
            </transactions>
          </agency>
        </agencies>
      </company>
    <total_operations>${ventas.length}</total_operations>
  </bulk_sales>`;
  return encabezado + ventas.map((v, i) => transaccion(v, k + i, fechaVenta, fechaProceso)).join('') + fin;
}

/** Campañas activas con los archivos ya generados de cada una. */
xmlRouter.get('/', async (_req, res) => {
  const campanas = await listarCampanas({ activas: true, flujo: FLUJO.BANCARIO });
  res.json(await Promise.all(campanas.map(async (c) => {
    const carpeta = carpetaDe(c.descripcion);
    let archivos: string[] = [];
    try {
      archivos = (await readdir(path.join(DIR_XML, carpeta))).filter((a) => a.endsWith('_bulk_sales.xml')).sort().reverse();
    } catch {
      archivos = [];
    }
    return { id: c.id, etiqueta: c.etiqueta, carpeta, archivos };
  })));
});

/** Genera el XML de las ventas de una campaña en una fecha (por defecto, hoy). */
xmlRouter.post('/', async (req, res) => {
  const fecha = req.body?.fecha === undefined || req.body?.fecha === '' ? hoy() : inputDate(req.body.fecha);
  const servicioId = inputInt(req.body?.servicio_id, 1);
  if (fecha === null || servicioId === null) throw invalido('Selecciona la campaña y una fecha válida.');

  const ventas = await prisma.$queryRaw<VentaXml[]>(Prisma.sql`
    SELECT r.id AS id_resultado, p.codigo_producto, p.costo_prod, p.codplan, r.nombre, r.apellido, r.nacionalidad, r.fecha_nacimiento,
           r.genero, r.cedula, r.telf_hab, r.telf_ofi, r.telf_celular, r.correo, r.cuenta, t.codigo AS cod_cuenta, t.nombre AS nombre_cuenta,
           e.estado, e.codigo AS codigo_estado, c.ciudad, c.codigo AS codigo_ciudad, m.nombre AS municipio, m.codigo AS codigo_municipio,
           s.codigo AS company_code, s.descripcion AS nombre_servicio
      FROM resultados r
      JOIN estado e ON r.estado_id = e.id
      JOIN ciudad c ON r.ciudad_id = c.id
      JOIN municipio m ON r.municipio_id = m.id
      JOIN productos p ON r.producto_id = p.id
      JOIN tipo_cuentas t ON r.tipo_cuenta_id = t.id
      JOIN servicios s ON r.servicio_id = s.id
     WHERE r.fecha_venta = ${fecha}::date AND r.servicio_id = ${servicioId} AND s.status_id = ${REGISTRO.ACTIVO}
     ORDER BY r.id`);
  if (ventas.length === 0) throw invalido('No hay ventas para esa campaña en la fecha indicada.');

  const fechaXml = compacta(fecha);
  // Reserva los números de transacción dentro de una transacción con bloqueo:
  // dos generaciones simultáneas no pueden repetir numeración.
  const { primero, contenido } = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`LOCK TABLE transacciones IN EXCLUSIVE MODE`;
    const max = await tx.transaccion.aggregate({ _max: { id_transaccion: true } });
    const k = max._max.id_transaccion ?? 0;
    await tx.transaccion.createMany({ data: ventas.map((v, i) => ({ id_transaccion: k + i + 1, fecha: fechaXml, resultado_id: v.id_resultado })) });
    await tx.$executeRaw`SELECT setval(pg_get_serial_sequence('transacciones', 'id_transaccion'), ${k + ventas.length})`;
    return { primero: k, contenido: construirXml(ventas, k, fechaXml, fechaXml) };
  });

  const [hh, mm] = horaActual().split(':');
  const sello = `${fechaXml}${Number(hh)}${mm}`;
  const carpeta = carpetaDe(ventas[0]!.nombre_servicio);
  const dir = path.join(DIR_XML, carpeta);
  const archivo = `${sello}_bulk_sales.xml`;
  const md5 = `${createHash('md5').update(contenido).digest('hex')}  ${archivo}`;
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, archivo), contenido, 'utf8');
  await writeFile(path.join(dir, 'MD5SUM'), md5, 'utf8');
  await writeFile(path.join(dir, `${sello}_MD5SUM`), md5, 'utf8');

  logger.info({
    event: 'xml.generado', servicio_id: servicioId, fecha, operaciones: ventas.length, primera_transaccion: primero, archivo, user_id: sesionDe(req).userId,
  }, 'XML de ventas generado');
  res.status(201).json({ carpeta, archivo, operaciones: ventas.length });
});

/** Descarga un archivo generado (XML o su MD5SUM). */
xmlRouter.get('/archivos/:carpeta/:archivo', async (req, res) => {
  const carpeta = carpetaDe(String(req.params.carpeta));
  const archivo = String(req.params.archivo);
  if (carpeta === '' || carpeta !== req.params.carpeta || !ARCHIVO_VALIDO.test(archivo)) throw noEncontrado('Archivo no encontrado.');
  const ruta = path.join(DIR_XML, carpeta, archivo);
  try {
    if (!(await stat(ruta)).isFile()) throw new Error('no es archivo');
  } catch {
    throw noEncontrado('Archivo no encontrado.');
  }
  res.setHeader('Content-Type', archivo.endsWith('.xml') ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${archivo}"`);
  res.setHeader('Cache-Control', 'no-store');
  createReadStream(ruta).pipe(res);
});
