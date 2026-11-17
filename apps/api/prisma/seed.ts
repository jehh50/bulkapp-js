/**
 * Datos mínimos para una base nueva (sin importar desde MySQL): catálogos de
 * estados y roles, validaciones del Constructor y un administrador inicial.
 * Idempotente. La clave del administrador sale de SEED_ADMIN_PASSWORD.
 *
 *   SEED_ADMIN_PASSWORD='...' npm run db:seed
 */
import { FLUJO, PASSWORD_MIN, REGISTRO, ROL, ROL_NOMBRE } from '@bulkapp/shared';
import { prisma } from '../src/lib/core.ts';
import { hashPassword } from '../src/lib/seguridad.ts';

const ESTADOS = [
  'Inactivo', 'Activo', 'Sin contactar', 'Contactado', 'Rechazado', 'Actualizado', 'Efectiva', 'Contactado no efectivo',
  'Compromiso de pago', 'No pago', 'BBDD cerrada', 'Pago parcial',
];

const EXPRESIONES = [
  { clave: 'correo', nombre: 'Correo electrónico', descripcion: 'Exige un correo con usuario, @ y dominio con extensión.', patron: '^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+([.][A-Za-z0-9-]+)*[.][A-Za-z]{2,}$', transformacion: null, tipos: 'text', ejemplo_valido: 'ana.perez@empresa.com', ejemplo_invalido: 'ana.perez@empresa', orden: 10 },
  { clave: 'solo_numeros', nombre: 'Solo números', descripcion: 'Acepta únicamente dígitos del 0 al 9, sin espacios, puntos ni guiones.', patron: '^[0-9]+$', transformacion: null, tipos: 'text,textarea', ejemplo_valido: '12658457', ejemplo_invalido: '12.658.457', orden: 20 },
  { clave: 'solo_letras', nombre: 'Solo letras', descripcion: 'Acepta letras (con acentos y ñ) y espacios; rechaza números y símbolos.', patron: '^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]+$', transformacion: null, tipos: 'text,textarea', ejemplo_valido: 'María José', ejemplo_invalido: 'María José 2', orden: 30 },
  { clave: 'mayusculas', nombre: 'Convertir a mayúsculas', descripcion: 'No valida: convierte todo el texto a mayúsculas mientras se escribe y al guardar.', patron: null, transformacion: 'mayusculas', tipos: 'text,textarea', ejemplo_valido: 'juan pérez → JUAN PÉREZ', ejemplo_invalido: null, orden: 40 },
  { clave: 'telefono', nombre: 'Teléfono (banca)', descripcion: 'Formato de teléfono de banca: (XXXX)XXX-XX-XX. El campo se va formateando al escribir.', patron: '^[(][0-9]{4}[)][0-9]{3}-[0-9]{2}-[0-9]{2}$', transformacion: 'telefono', tipos: 'text', ejemplo_valido: '(0412)555-12-34', ejemplo_invalido: '04125551234', orden: 50 },
];

async function main(): Promise<void> {
  for (const [i, name] of ESTADOS.entries()) {
    await prisma.status.upsert({ where: { id: i + 1 }, update: { name }, create: { id: i + 1, name } });
  }
  for (const id of [ROL.OPERADOR, ROL.SUPERVISOR, ROL.ADMINISTRADOR]) {
    await prisma.usertype.upsert({ where: { id }, update: { name: ROL_NOMBRE[id]! }, create: { id, name: ROL_NOMBRE[id]! } });
  }
  for (const e of EXPRESIONES) {
    await prisma.formularioExpresion.upsert({ where: { clave: e.clave }, update: e, create: e });
  }
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('status', 'id'), (SELECT MAX(id) FROM status))`;
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('usertypes', 'id'), (SELECT MAX(id) FROM usertypes))`;

  if ((await prisma.user.count()) > 0) {
    console.log('Catálogos listos. Ya existen usuarios: no se crea el administrador inicial.');
    return;
  }
  const password = process.env.SEED_ADMIN_PASSWORD ?? '';
  if (password.length < PASSWORD_MIN) {
    console.log(`Catálogos listos. Define SEED_ADMIN_PASSWORD (${PASSWORD_MIN}+ caracteres) para crear el administrador inicial.`);
    return;
  }

  const empresa = await prisma.empresa.upsert({ where: { nombre: 'Empresa inicial' }, update: {}, create: { nombre: 'Empresa inicial' } });
  const campana = await prisma.servicio.findFirst({ where: { empresa_id: empresa.id } })
    ?? await prisma.servicio.create({ data: { empresa_id: empresa.id, descripcion: 'Campaña inicial', fecha_inicio: new Date(), tipo_flujo: FLUJO.DINAMICO } });
  const admin = await prisma.user.create({
    data: {
      nombre: 'Administrador', apellido: 'BulkApp', username: 'admin', password: await hashPassword(password),
      usertype_id: ROL.ADMINISTRADOR, status_id: REGISTRO.ACTIVO, servicio_id: campana.id,
    },
  });
  await prisma.usuarioServicio.create({ data: { user_id: admin.id, servicio_id: campana.id } });
  console.log('Administrador inicial creado: usuario «admin».');
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
