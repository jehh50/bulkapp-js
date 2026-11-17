/**
 * Pruebas de la API que no necesitan base de datos: seguridad (hash y JWT),
 * fechas de negocio y el documento XML de ventas.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, describe, it } from 'node:test';
import { ROL } from '@bulkapp/shared';
import { compacta, fechaLarga, finDeMes, prisma, sumarMeses } from '../src/lib/core.ts';
import {
  firmarAcceso, firmarRefresco, hashPassword, huellaCoincide, necesitaRehash, passwordAleatoria, verificarAcceso, verificarPassword, verificarRefresco,
} from '../src/lib/seguridad.ts';
import { construirXml } from '../src/modules/xml.ts';

after(() => prisma.$disconnect());

describe('contraseñas', () => {
  it('bcrypt: verifica y no pide rehash', async () => {
    const hash = await hashPassword('secreta-123');
    assert.equal(await verificarPassword('secreta-123', hash), true);
    assert.equal(await verificarPassword('otra', hash), false);
    assert.equal(necesitaRehash(hash), false);
  });
  it('acepta hashes $2y$ generados por PHP', async () => {
    const dePhp = (await hashPassword('clave-php')).replace(/^\$2[ab]\$/, '$2y$');
    assert.equal(await verificarPassword('clave-php', dePhp), true);
  });
  it('MD5 heredado: verifica y pide rehash', async () => {
    const md5 = createHash('md5').update('vieja').digest('hex');
    assert.equal(await verificarPassword('vieja', md5), true);
    assert.equal(await verificarPassword('otra', md5), false);
    assert.equal(necesitaRehash(md5), true);
  });
  it('genera contraseñas temporales del largo pedido', () => {
    assert.equal(passwordAleatoria(14).length, 14);
    assert.notEqual(passwordAleatoria(14), passwordAleatoria(14));
  });
});

describe('JWT', () => {
  it('el token de acceso lleva usuario, rol y campaña', () => {
    const claims = verificarAcceso(firmarAcceso({ sub: 7, rol: ROL.SUPERVISOR, sid: 5 }));
    assert.deepEqual(claims && { sub: claims.sub, rol: claims.rol, sid: claims.sid }, { sub: 7, rol: ROL.SUPERVISOR, sid: 5 });
  });
  it('un token de refresco no sirve como token de acceso, ni al revés', () => {
    const refresco = firmarRefresco(7, 5, 'hash-a');
    assert.equal(verificarAcceso(refresco), null);
    assert.equal(verificarRefresco(firmarAcceso({ sub: 7, rol: ROL.OPERADOR, sid: 5 })), null);
    assert.equal(verificarAcceso('no.es.un-token'), null);
  });
  it('cambiar la contraseña invalida el token de refresco', () => {
    const claims = verificarRefresco(firmarRefresco(7, 5, 'hash-a'));
    assert.ok(claims);
    assert.equal(huellaCoincide(claims.pv, 'hash-a'), true);
    assert.equal(huellaCoincide(claims.pv, 'hash-b'), false);
  });
});

describe('fechas', () => {
  it('suma meses sin desbordar el fin de mes', () => {
    assert.equal(sumarMeses('2026-10-20', 1), '2026-11-20');
    assert.equal(sumarMeses('2026-12-15', 1), '2027-01-15');
    assert.equal(finDeMes('2028-02'), '2028-02-29');
    assert.equal(compacta('2026-10-20'), '20261020');
    assert.equal(fechaLarga('2026-10-20'), '20/10/2026');
  });
});

describe('XML de ventas', () => {
  const venta = {
    id_resultado: 1, codigo_producto: '11', costo_prod: '4.99', codplan: 'SO06', nombre: 'ANA & CÍA', apellido: 'PÉREZ <X>', nacionalidad: '1',
    fecha_nacimiento: new Date('1996-01-01T00:00:00Z'), genero: 'F', cedula: '22222222', telf_hab: '(0212)555.12.34', telf_ofi: null,
    telf_celular: '(0412)555.12.34', correo: 'ana@correo.com', cuenta: '01710016536000661406', cod_cuenta: 1, nombre_cuenta: 'AHORRO',
    estado: 'MIRANDA   ', codigo_estado: 15, ciudad: 'CARACAS ', codigo_ciudad: '1', municipio: 'SUCRE ', codigo_municipio: '2', company_code: '5',
    nombre_servicio: 'Banco Activo',
  };
  const xml = construirXml([venta, { ...venta, id_resultado: 2 }], 6104709, '20261020', '20261020');

  it('numera las transacciones de forma consecutiva y cuenta las operaciones', () => {
    assert.deepEqual([...xml.matchAll(/<transaction id="(\d+)">/g)].map((m) => m[1]), ['6104709', '6104710']);
    assert.match(xml, /<total_operations>2<\/total_operations>/);
    assert.match(xml, /<company code="5">/);
  });
  it('escapa los datos y formatea fechas y certificado', () => {
    assert.match(xml, /<name>ANA &amp; CÍA<\/name>/);
    assert.match(xml, /<last_name>PÉREZ &lt;X&gt;<\/last_name>/);
    assert.match(xml, /<certificate_number>000006104709<\/certificate_number>/);
    assert.match(xml, /<birthdate>19960101<\/birthdate>/);
    assert.match(xml, /<begin_date>20261020<\/begin_date>\s*<end_date>20261120<\/end_date>/);
    assert.match(xml, /<office_telephone1>\(0000\)000\.00\.00<\/office_telephone1>/);
    assert.match(xml, /<state_name>MIRANDA<\/state_name>/);
  });
});
