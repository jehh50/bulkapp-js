/**
 * Formulario de gestión bancario: buscar cliente → registrar el resultado de la
 * llamada y, si es venta, los datos del titular.
 */
import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, Chip, Divider, Grid, Stack, TextField, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EFECTIVO_VENTA_ID, GENEROS, NACIONALIDADES, NACIONALIDAD_NOMBRE, mascaraTelefonoBanca, validarGestion } from '@bulkapp/shared';
import { ApiError, api, mensajeDe } from '../shared/api.ts';
import { CampoFecha, Consulta, Indicador, Pagina, Seccion, Selector, useAvisos, type Opcion } from '../shared/ui.tsx';

interface Item { id: number; descripcion: string }
interface Nombrado { id: number; nombre: string }
interface Catalogos {
  efectivo: Item[]; noefectivo: Item[]; estados: Array<{ id: number; estado: string }>; productos: Item[]; tiposCuenta: Nombrado[];
}
interface Cliente {
  id: number; nombre: string | null; identificacion: string | null; telf_hab: string | null; telf_ofi: string | null; telf_cel: string | null;
  correo: string | null; direccion: string | null; cuenta: string | null; oferta: string;
}
type Busqueda = { estado: 'no_encontrado' | 'atendido' } | { estado: 'encontrado'; cliente: Cliente };
interface Indicadores { efectivos: number; ventas: number; porProducto: Array<{ producto: string | null; vendidos: number }> }

const VACIO = {
  contacto: '', efectivo: '', noefectivo: '', sub_contacto: '', producto: '', nombre: '', apellido: '', genero: '', fecha_nac: '',
  nacionalidad: '', cedula: '', telf_hab: '', telf_cel: '', correo: '', estado: '', ciudad: '', municipio: '', tipo_cuenta: '', pan: '',
  observaciones: '',
};
type Campos = typeof VACIO;
type Campo = keyof Campos;

const opciones = (items: Item[]): Opcion[] => items.map((i) => ({ value: String(i.id), label: i.descripcion }));
const nombradas = (items: Nombrado[] | undefined): Opcion[] => (items ?? []).map((i) => ({ value: String(i.id), label: i.nombre }));

export default function CapturaBancariaPage() {
  const avisos = useAvisos();
  const cache = useQueryClient();
  const [termino, setTermino] = useState('');
  const [busqueda, setBusqueda] = useState<Busqueda | null>(null);
  const [f, setF] = useState<Campos>(VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});

  const catalogos = useQuery({ queryKey: ['bancario', 'catalogos'], queryFn: () => api.get<Catalogos>('/bancario/catalogos'), staleTime: 300_000 });
  const indicadores = useQuery({ queryKey: ['bancario', 'indicadores'], queryFn: () => api.get<Indicadores>('/bancario/indicadores') });
  const ciudades = useQuery({
    queryKey: ['bancario', 'ciudades', f.estado], enabled: f.estado !== '', staleTime: 300_000,
    queryFn: () => api.get<Nombrado[]>('/bancario/catalogos/ciudades', { estado_id: f.estado }),
  });
  const municipios = useQuery({
    queryKey: ['bancario', 'municipios', f.estado], enabled: f.estado !== '', staleTime: 300_000,
    queryFn: () => api.get<Nombrado[]>('/bancario/catalogos/municipios', { estado_id: f.estado }),
  });
  const subcontactos = useQuery({
    queryKey: ['bancario', 'subcontactos', f.efectivo], enabled: f.efectivo !== '', staleTime: 300_000,
    queryFn: () => api.get<Nombrado[]>('/bancario/catalogos/subcontactos', { efectivo_id: f.efectivo }),
  });

  const cliente = busqueda?.estado === 'encontrado' ? busqueda.cliente : null;
  const esVenta = f.contacto === '1' && Number(f.efectivo) === EFECTIVO_VENTA_ID;

  const limpiar = () => {
    setBusqueda(null);
    setF(VACIO);
    setErrores({});
    setTermino('');
  };

  const buscar = useMutation({
    mutationFn: (q: string) => api.get<Busqueda>('/bancario/clientes', { q }),
    onSuccess: (r) => {
      setBusqueda(r);
      setErrores({});
      setF(r.estado === 'encontrado'
        ? { ...VACIO, cedula: (r.cliente.identificacion ?? '').replace(/\D+/g, '').slice(0, 10), correo: r.cliente.correo ?? '' }
        : VACIO);
    },
    onError: (e) => avisos.error(e),
  });

  const guardar = useMutation({
    mutationFn: (cuerpo: Record<string, unknown>) => api.post<{ id: number; venta: boolean }>('/bancario/gestiones', cuerpo),
    onSuccess: (r) => {
      avisos.ok(r.venta ? 'Venta registrada.' : 'Gestión registrada.');
      limpiar();
      void cache.invalidateQueries({ queryKey: ['bancario', 'indicadores'] });
    },
    onError: (e) => {
      if (e instanceof ApiError) setErrores(e.porCampo);
      if (e instanceof ApiError && e.code === 'cliente_atendido') limpiar();
      avisos.error(e);
    },
  });

  const cambiar = (k: Campo, valor: string) => {
    setF((previo) => {
      const siguiente = { ...previo, [k]: valor };
      // Cada elección reinicia las que dependen de ella.
      if (k === 'contacto') Object.assign(siguiente, { efectivo: '', noefectivo: '', sub_contacto: '', producto: '' });
      if (k === 'efectivo') Object.assign(siguiente, { sub_contacto: '', producto: '' });
      if (k === 'estado') Object.assign(siguiente, { ciudad: '', municipio: '' });
      return siguiente;
    });
    setErrores((previo) => {
      if (!(k in previo)) return previo;
      const { [k]: _quitado, ...resto } = previo;
      return resto;
    });
  };

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!cliente) return;
    const cuerpo: Record<string, unknown> = {
      id_cliente: cliente.id, contacto: f.contacto,
      efectivo: f.contacto === '1' ? f.efectivo : '', noefectivo: f.contacto === '0' ? f.noefectivo : '',
      sub_contacto: f.sub_contacto, producto: esVenta ? f.producto : '',
      ...(esVenta ? {
        nombre: f.nombre, apellido: f.apellido, genero: f.genero, fecha_nac: f.fecha_nac, nacionalidad: f.nacionalidad, cedula: f.cedula,
        telf_hab: f.telf_hab, telf_cel: f.telf_cel, correo: f.correo, estado: f.estado, ciudad: f.ciudad, municipio: f.municipio,
        tipo_cuenta: f.tipo_cuenta, pan: f.pan, observaciones: f.observaciones,
      } : {}),
    };
    // Misma validación que el servidor, para avisar sin ir a la red.
    const validacion = validarGestion(cuerpo);
    if (!validacion.ok) {
      setErrores(validacion.errores);
      avisos.error('Revisa los campos marcados.');
      return;
    }
    guardar.mutate(cuerpo);
  };

  const texto = (k: Campo, label: string, extra: { max?: number; telefono?: boolean; tipo?: string; multilinea?: boolean; requerido?: boolean } = {}) => (
    <TextField
      label={label} value={f[k]} fullWidth type={extra.tipo ?? 'text'} required={extra.requerido ?? true}
      multiline={extra.multilinea} minRows={extra.multilinea ? 2 : undefined}
      onChange={(e) => cambiar(k, extra.telefono ? mascaraTelefonoBanca(e.target.value) : e.target.value)}
      placeholder={extra.telefono ? '(0412)555.12.34' : undefined}
      error={k in errores} helperText={errores[k]} slotProps={{ htmlInput: { maxLength: extra.max } }}
    />
  );
  const lista = (k: Campo, label: string, ops: Opcion[], extra: { deshabilitado?: boolean; requerido?: boolean } = {}) => (
    <Selector
      label={label} value={f[k]} opciones={ops} vacio="Selecciona…" required={extra.requerido ?? true} disabled={extra.deshabilitado}
      onChange={(e) => cambiar(k, e.target.value)} error={k in errores} helperText={errores[k]}
    />
  );

  return (
    <Pagina titulo="Formulario de gestión" subtitulo="Busca al cliente por cédula o teléfono y registra el resultado de la llamada.">
      <Stack spacing={3}>
        <Consulta query={indicadores}>
          {(i) => (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Indicador etiqueta="Contactos efectivos hoy" valor={i.efectivos} />
              <Indicador etiqueta="Ventas hoy" valor={i.ventas} color="success.main" />
              {i.porProducto.map((p) => <Indicador key={p.producto ?? '—'} etiqueta={p.producto ?? 'Sin producto'} valor={p.vendidos} color="secondary.main" />)}
            </Stack>
          )}
        </Consulta>

        <Seccion titulo="Buscar cliente">
          <Stack
            component="form" direction={{ xs: 'column', sm: 'row' }} spacing={1.5}
            onSubmit={(e) => { e.preventDefault(); if (termino.trim() !== '') buscar.mutate(termino.trim()); }}
          >
            <TextField
              label="Cédula o teléfono" value={termino} onChange={(e) => setTermino(e.target.value)} sx={{ flex: 1, maxWidth: 420 }}
              slotProps={{ htmlInput: { maxLength: 30, inputMode: 'numeric' } }} autoFocus
            />
            <Button type="submit" variant="contained" startIcon={<SearchIcon />} loading={buscar.isPending}>Buscar</Button>
            {busqueda && <Button onClick={limpiar}>Limpiar</Button>}
          </Stack>
          {busqueda?.estado === 'no_encontrado' && <Alert severity="warning" sx={{ mt: 2 }}>No se encontró ningún cliente con ese dato en tu campaña.</Alert>}
          {busqueda?.estado === 'atendido' && <Alert severity="info" sx={{ mt: 2 }}>Este cliente ya fue atendido (tiene una venta registrada).</Alert>}
        </Seccion>

        {cliente && (
          <Consulta query={catalogos}>
            {(c) => (
              <Box component="form" onSubmit={enviar} noValidate>
                <Stack spacing={3}>
                  <Seccion titulo="Datos del cliente" acciones={cliente.oferta ? <Chip color="secondary" label={`Oferta: ${cliente.oferta}`} /> : undefined}>
                    <Grid container spacing={2}>
                      {([
                        ['Nombre', cliente.nombre], ['Cédula', cliente.identificacion], ['Teléfono habitación', cliente.telf_hab],
                        ['Teléfono oficina', cliente.telf_ofi], ['Teléfono celular', cliente.telf_cel], ['Correo', cliente.correo],
                        ['Dirección', cliente.direccion], ['Cuenta', cliente.cuenta],
                      ] as const).map(([etiqueta, valor]) => (
                        <Grid key={etiqueta} size={{ xs: 12, sm: 6, md: 3 }}>
                          <Typography variant="caption" color="text.secondary">{etiqueta}</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500, overflowWrap: 'anywhere' }}>{valor || 'No posee'}</Typography>
                        </Grid>
                      ))}
                    </Grid>
                  </Seccion>

                  <Seccion titulo="Resultado de la llamada">
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        {lista('contacto', '¿Hubo contacto?', [{ value: '1', label: 'Contacto efectivo' }, { value: '0', label: 'Contacto no efectivo' }])}
                      </Grid>
                      {f.contacto === '1' && (
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>{lista('efectivo', 'Contacto efectivo', opciones(c.efectivo))}</Grid>
                      )}
                      {f.contacto === '0' && (
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>{lista('noefectivo', 'Motivo no efectivo', opciones(c.noefectivo))}</Grid>
                      )}
                      {f.contacto === '1' && (subcontactos.data?.length ?? 0) > 0 && (
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>{lista('sub_contacto', 'Subcontacto', nombradas(subcontactos.data), { requerido: false })}</Grid>
                      )}
                      {esVenta && (
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>{lista('producto', 'Producto vendido', opciones(c.productos))}</Grid>
                      )}
                    </Grid>
                    {'id_cliente' in errores && <Alert severity="error" sx={{ mt: 2 }}>{errores.id_cliente}</Alert>}
                  </Seccion>

                  {esVenta && (
                    <Seccion titulo="Datos de la venta">
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>{texto('nombre', 'Nombre', { max: 60 })}</Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>{texto('apellido', 'Apellido', { max: 60 })}</Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                          {lista('genero', 'Género', GENEROS.map((g) => ({ value: g, label: g === 'M' ? 'Masculino' : 'Femenino' })))}
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                          <CampoFecha label="Fecha de nacimiento" value={f.fecha_nac} required onChange={(e) => cambiar('fecha_nac', e.target.value)} error={'fecha_nac' in errores} helperText={errores.fecha_nac} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                          {lista('nacionalidad', 'Nacionalidad', NACIONALIDADES.map((n) => ({ value: String(n), label: NACIONALIDAD_NOMBRE[n] ?? String(n) })))}
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>{texto('cedula', 'Cédula', { max: 10 })}</Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>{texto('telf_hab', 'Teléfono habitación', { telefono: true })}</Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>{texto('telf_cel', 'Teléfono celular', { telefono: true })}</Grid>
                        <Grid size={{ xs: 12, md: 6 }}>{texto('correo', 'Correo', { max: 150, tipo: 'email' })}</Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                          {lista('estado', 'Estado', c.estados.map((e) => ({ value: String(e.id), label: e.estado.trim() })))}
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>{lista('ciudad', 'Ciudad', nombradas(ciudades.data), { deshabilitado: f.estado === '' })}</Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>{lista('municipio', 'Municipio', nombradas(municipios.data), { deshabilitado: f.estado === '' })}</Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>{lista('tipo_cuenta', 'Tipo de cuenta', nombradas(c.tiposCuenta))}</Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <TextField
                            label="Número de cuenta (20 dígitos)" value={f.pan} fullWidth onChange={(e) => cambiar('pan', e.target.value.replace(/\D+/g, '').slice(0, 20))}
                            error={'pan' in errores} helperText={errores.pan ?? 'Opcional. Si se deja vacío se registra en ceros.'}
                            slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                          />
                        </Grid>
                        <Grid size={12}>{texto('observaciones', 'Observaciones', { max: 250, multilinea: true, requerido: false })}</Grid>
                      </Grid>
                    </Seccion>
                  )}

                  <Divider />
                  <Stack direction="row" spacing={1.5}>
                    <Button type="submit" variant="contained" size="large" loading={guardar.isPending}>{esVenta ? 'Registrar venta' : 'Registrar gestión'}</Button>
                    <Button size="large" onClick={limpiar} disabled={guardar.isPending}>Cancelar</Button>
                  </Stack>
                  {guardar.isError && !(guardar.error instanceof ApiError && guardar.error.status === 422) && (
                    <Alert severity="error">{mensajeDe(guardar.error)}</Alert>
                  )}
                </Stack>
              </Box>
            )}
          </Consulta>
        )}
      </Stack>
    </Pagina>
  );
}
