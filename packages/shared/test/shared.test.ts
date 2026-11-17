import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ESTADO, FLUJO, aplicarColumnas, etiquetaCampana, indexarExpresiones, inputAmount, inputDate, inputDigits, inputEmail, inputEnum, inputInt,
  inputLetters, inputPan, inputPhone, inputString, mascaraTelefonoBanca, mascaraTelefonoFormulario, normalizarColumnas, normalizarFechaNacimiento,
  normalizarRif, slug, slugColumna, validarCampana, validarDefinicion, validarEmpresa, validarGestion, validarValores, valorComoTexto,
  type Definicion,
} from '../src/index.ts';

describe('input', () => {
  it('inputString recorta, limpia caracteres de control y limita el largo', () => {
    assert.equal(inputString('  hola\u0000  '), 'hola');
    assert.equal(inputString('abcdef', 3), 'abc');
    assert.equal(inputString({ a: 1 }), '');
  });
  it('inputInt valida enteros y rangos', () => {
    assert.equal(inputInt('12', 1), 12);
    assert.equal(inputInt('0', 1), null);
    assert.equal(inputInt('1.5'), null);
    assert.equal(inputInt('1 OR 1=1'), null);
  });
  it('inputEnum devuelve el valor tipado de la lista', () => {
    assert.equal(inputEnum('2', [1, 2, 3]), 2);
    assert.equal(inputEnum('9', [1, 2, 3]), null);
  });
  it('inputDate rechaza fechas imposibles', () => {
    assert.equal(inputDate('2026-02-28'), '2026-02-28');
    assert.equal(inputDate('2026-02-30'), null);
    assert.equal(inputDate('28-02-2026'), null);
  });
  it('correo, letras, dígitos, cuenta, teléfono y monto', () => {
    assert.equal(inputEmail('a@b.com'), 'a@b.com');
    assert.equal(inputEmail('a@b'), null);
    assert.equal(inputLetters('José  María 3'), 'José María');
    assert.equal(inputDigits('V-12.345.678'), '12345678');
    assert.equal(inputPan('0171****1406'), '0171****1406');
    assert.equal(inputPan('abc'), null);
    assert.equal(inputPhone('(0412)555.12.34'), '(0412)555.12.34');
    assert.equal(inputPhone('0412-abc'), null);
    assert.equal(inputAmount('4,99'), '4,99');
    assert.equal(inputAmount('4.99 USD'), null);
  });
  it('máscaras de teléfono y slug', () => {
    assert.equal(mascaraTelefonoBanca('04125551234'), '(0412)555.12.34');
    assert.equal(mascaraTelefonoFormulario('04125551234'), '(0412)555-12-34');
    assert.equal(mascaraTelefonoBanca('0412'), '(0412)');
    assert.equal(slug('Movistar MX › Portabilidad'), 'movistar-mx-portabilidad');
    assert.equal(slugColumna('Nº Teléfono'), 'n_telefono');
    assert.equal(slugColumna('2do nombre'), 'c_2do_nombre');
  });
});

describe('campañas', () => {
  it('etiqueta «Empresa › Campaña» sin repetir nombres iguales', () => {
    assert.equal(etiquetaCampana('Movistar MX', 'Portabilidad'), 'Movistar MX › Portabilidad');
    assert.equal(etiquetaCampana('Bancaribe', 'bancaribe '), 'bancaribe');
    assert.equal(etiquetaCampana(null, 'Portabilidad'), 'Portabilidad');
  });
  it('normaliza el RIF', () => {
    assert.equal(normalizarRif('j123456789'), 'J-12345678-9');
    assert.equal(normalizarRif(''), '');
    assert.equal(normalizarRif('X-1'), null);
  });
  it('valida empresa y campaña', () => {
    assert.equal(validarEmpresa({ nombre: '', identificacion: '' }).ok, false);
    assert.deepEqual(validarEmpresa({ nombre: ' Acme  SA ', identificacion: '' }).datos, { nombre: 'Acme SA', identificacion: null, status_id: 2 });
    const sinCodigo = validarCampana({ nombre: 'Banca', fecha_inicio: '2026-01-01', tipo_flujo: FLUJO.BANCARIO, codigo: '' }, true);
    assert.equal(sinCodigo.ok, false);
    const dinamica = validarCampana({ nombre: 'Ventas', fecha_inicio: '2026-01-01', tipo_flujo: FLUJO.DINAMICO, meta: '100' }, true);
    assert.equal(dinamica.ok, true);
    assert.equal(dinamica.datos.meta, 100);
    // Al editar no se exige ni se devuelve el flujo: no se puede cambiar.
    const edicion = validarCampana({ nombre: 'Ventas', fecha_inicio: '2026-01-01', tipo_flujo: FLUJO.BANCARIO }, false);
    assert.equal(edicion.ok, true);
    assert.equal('tipo_flujo' in edicion.datos, false);
  });
});

describe('gestión bancaria', () => {
  const venta = {
    id_cliente: 10, contacto: 1, efectivo: 1, producto: 9, nombre: 'Ana', apellido: 'Pérez', genero: 'F', fecha_nac: '01-02-1990', cedula: '12345678',
    correo: 'ana@correo.com', telf_hab: '(0212)555.12.34', telf_cel: '(0412)555.12.34', estado: 1, ciudad: 2, municipio: 3, nacionalidad: 1, tipo_cuenta: 1,
  };
  it('no efectivo → estado 3; efectivo sin venta → estado 4', () => {
    const no = validarGestion({ id_cliente: 10, contacto: 0, noefectivo: 2 });
    assert.ok(no.ok);
    assert.equal(no.datos.status, ESTADO.NO_EFECTIVO);
    assert.equal(no.datos.esVenta, false);
    const si = validarGestion({ id_cliente: 10, contacto: 1, efectivo: 3 });
    assert.ok(si.ok);
    assert.equal(si.datos.status, ESTADO.EFECTIVO);
  });
  it('venta → estado 7, cuenta por defecto y fecha normalizada', () => {
    const r = validarGestion(venta);
    assert.ok(r.ok);
    assert.equal(r.datos.status, ESTADO.ATENDIDO);
    assert.equal(r.datos.venta?.fecha_nac, '1990-02-01');
    assert.equal(r.datos.venta?.cuenta, '00000000000000000000');
  });
  it('una venta incompleta reporta cada campo', () => {
    const r = validarGestion({ id_cliente: 10, contacto: 1, efectivo: 1 });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.ok('producto' in r.errores);
      assert.ok('nombre' in r.errores);
      assert.ok('estado' in r.errores);
    }
  });
  it('exige cliente y resultado', () => {
    const r = validarGestion({ contacto: 1 });
    assert.equal(r.ok, false);
    if (!r.ok) assert.deepEqual(Object.keys(r.errores).sort(), ['efectivo', 'id_cliente']);
  });
  it('normaliza la fecha de nacimiento', () => {
    assert.equal(normalizarFechaNacimiento('31-12-1999'), '1999-12-31');
    assert.equal(normalizarFechaNacimiento('1999-12-31'), '1999-12-31');
    assert.equal(normalizarFechaNacimiento('31/12/1999'), null);
  });
});

describe('formularios dinámicos', () => {
  const catalogo = indexarExpresiones([
    { clave: 'solo_numeros', patron: '^[0-9]+$', transformacion: null, tipos: 'text,textarea' },
    { clave: 'mayusculas', patron: null, transformacion: 'mayusculas', tipos: 'text' },
  ]);

  it('normaliza la definición y congela la expresión del catálogo', () => {
    const r = validarDefinicion({ campos: [{ k: 'doc', type: 'text', label: ' Documento ', expr: 'solo_numeros', regex: '.*', req: 1 }] }, catalogo);
    assert.equal(r.ok, true);
    assert.deepEqual(r.definicion.campos[0], { k: 'doc', type: 'text', label: 'Documento', req: true, expr: 'solo_numeros', regex: '^[0-9]+$' });
  });
  it('rechaza claves repetidas, tipos inválidos, expresiones ajenas y condiciones hacia adelante', () => {
    const r = validarDefinicion({
      campos: [
        { k: 'a', type: 'text', label: 'A', cond: { k: 'b', v: 'x' } },
        { k: 'a', type: 'text', label: 'A2' },
        { k: 'b', type: 'raro', label: 'B' },
        { k: 'c', type: 'number', label: 'C', expr: 'solo_numeros' },
        { k: 'd', type: 'select', label: 'D', opts: [] },
      ],
    }, catalogo);
    assert.equal(r.ok, false);
    assert.equal(r.errores.length, 5);
  });

  const definicion: Definicion = {
    campos: [
      { k: 'nombre', type: 'text', label: 'Nombre', req: true, transform: 'mayusculas' },
      { k: 'interes', type: 'select', label: 'Interés', opts: ['Sí', 'No'], req: true },
      { k: 'motivo', type: 'text', label: 'Motivo', req: true, cond: { k: 'interes', v: 'No' } },
      { k: 'plan', type: 'nested', label: 'Plan', tree: [{ p: 'Móvil', c: 'Prepago, Pospago' }] },
      { k: 'edad', type: 'number', label: 'Edad', min: 18, max: 99 },
    ],
  };
  it('valida valores, aplica transformaciones y descarta lo desconocido', () => {
    const r = validarValores(definicion, { nombre: ' ana ', interes: 'Sí', motivo: 'no aplica', plan: { lv1: 'Móvil', lv2: 'Pospago' }, edad: '30', extra: 'x' });
    assert.equal(r.ok, true);
    assert.deepEqual(r.valores, { nombre: 'ANA', interes: 'Sí', plan: { lv1: 'Móvil', lv2: 'Pospago' }, edad: '30' });
  });
  it('un campo condicional visible es obligatorio; los límites se respetan', () => {
    const r = validarValores(definicion, { nombre: 'Ana', interes: 'No', plan: { lv1: 'Móvil', lv2: 'Fibra' }, edad: '12' });
    assert.deepEqual(Object.keys(r.errores).sort(), ['edad', 'motivo', 'plan']);
  });
  it('valorComoTexto aplana los anidados', () => {
    assert.equal(valorComoTexto({ lv1: 'Móvil', lv2: 'Pospago' }), 'Móvil / Pospago');
    assert.equal(valorComoTexto('x'), 'x');
    assert.equal(valorComoTexto(undefined), '');
  });
  it('columnas de la BD: claves estables, búsqueda obligatoria y filas sin clave omitidas', () => {
    const headers = ['Cédula', 'Nombre', 'Nombre'];
    assert.equal(normalizarColumnas({ busqueda: 'Teléfono', columnas: [{ col: 'Cédula' }] }, headers).ok, false);
    const r = normalizarColumnas({ busqueda: 'Cédula', columnas: [{ col: 'Cédula', label: 'CI' }, { col: 'Nombre' }] }, headers);
    assert.ok(r.columnas);
    assert.deepEqual(r.columnas, { busqueda: 'cedula', columnas: [{ k: 'cedula', col: 'Cédula', label: 'CI' }, { k: 'nombre', col: 'Nombre', label: 'Nombre' }] });
    assert.deepEqual(aplicarColumnas(headers, [['1', ' Ana ', 'x'], ['', 'Sin clave', 'y']], r.columnas), [{ cedula: '1', nombre: 'Ana' }]);
  });
});
