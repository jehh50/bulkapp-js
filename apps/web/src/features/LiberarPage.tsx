/**
 * Liberar clientes con el diseño de `views/reportes/liberar.php`: tarjeta de 620px
 * con la cédula, ficha «Cliente encontrado» con su estatus, botón dorado «Liberar
 * cliente» y ventana de confirmación «Número liberado correctamente».
 * Mismas reglas del PHP: no se libera un cliente sin contactar ni uno eliminado.
 */
import { useState, type FormEvent } from 'react';
import { Box, Button, Dialog, DialogContent, Table, TableBody, TableCell, TableRow, TextField, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { api, mensajeDe } from '../shared/api.ts';
import { BOTON_DORADO, ErrorForm, TarjetaConfig } from '../shared/config.tsx';
import { Pagina } from '../shared/ui.tsx';

interface Cliente { id: number; nombre_legal: string | null; telf_hab: string | null; telf_ofi: string | null; telf_cel: string | null; identificacion: string | null; status: string | null; servicio: string }

/** Motivo por el que no se puede liberar (textos del PHP), o null si se puede. */
function bloqueo(c: Cliente): string | null {
  const s = (c.status ?? '').trim().toLowerCase();
  if (s === '' || s === 'abierto') return 'Este cliente aún no ha sido contactado.';
  if (s === 'eliminado') return 'Este cliente fue eliminado por una venta errada. No se puede liberar.';
  return null;
}

export default function LiberarPage() {
  const [cedula, setCedula] = useState('');
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<Cliente | null>(null);

  const buscar = useMutation({
    mutationFn: (q: string) => api.get<Cliente[]>('/admin/clientes', { q }),
    onMutate: () => { setError(null); setCliente(null); },
    onSuccess: (lista) => {
      // Si la cédula está en varias campañas se muestra la primera que pueda liberarse.
      const c = lista.find((x) => x.identificacion === cedula && bloqueo(x) === null) ?? lista.find((x) => x.identificacion === cedula);
      if (!c) { setError('La cédula no existe. Verifique e intente nuevamente.'); return; }
      const motivo = bloqueo(c);
      if (motivo) { setError(motivo); return; }
      setCliente(c);
    },
    onError: (e) => setError(mensajeDe(e)),
  });
  const liberar = useMutation({
    mutationFn: (c: Cliente) => api.post<{ liberados: number }>('/admin/clientes/liberar', { identificacion: c.identificacion }),
    onSuccess: (_r, c) => setHecho(c),
    onError: (e) => setError(mensajeDe(e)),
  });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (cedula.trim() === '') { setError('Introduzca un número de cédula válido e intente de nuevo.'); setCliente(null); return; }
    buscar.mutate(cedula.trim());
  };
  const aceptar = () => { setHecho(null); setCliente(null); setCedula(''); };
  const filas: Array<[string, string]> = cliente ? [
    ['Nombre', cliente.nombre_legal ?? ''], ['Cédula', cliente.identificacion ?? ''], ['Teléfono habitación', cliente.telf_hab ?? ''],
    ['Teléfono oficina', cliente.telf_ofi ?? ''], ['Teléfono celular', cliente.telf_cel ?? ''], ['Servicio', cliente.servicio.trim()],
  ] : [];

  return (
    <Pagina miga="Reportes / Liberar clientes Banca" titulo="Liberar clientes" subtitulo="Devuelve un cliente gestionado a «sin contactar» para que pueda volver a llamarse.">
      <Box sx={{ maxWidth: 620, mx: 'auto' }}>
        <TarjetaConfig>
          <Box component="form" onSubmit={enviar} noValidate>
            <Typography component="label" htmlFor="cliente" sx={{ display: 'block', fontWeight: 600, mb: 1 }}>Introduzca el número de cédula del cliente a liberar</Typography>
            <TextField
              id="cliente" fullWidth autoFocus value={cedula} placeholder="Ej. 16136850"
              onChange={(e) => setCedula(e.target.value.replace(/\D+/g, '').slice(0, 11))}
              slotProps={{ htmlInput: { inputMode: 'numeric' } }} sx={{ '& input': { height: 30, fontSize: 15 } }}
            />
            <Button type="submit" variant="contained" fullWidth loading={buscar.isPending} sx={{ mt: 2, height: 48, fontSize: 16 }}>Buscar</Button>
          </Box>
          {error && <ErrorForm>{error}</ErrorForm>}

          {cliente && (
            <Box sx={{ mt: 1 }}>
              <Box sx={{ border: '1px solid #dfe5f2', borderRadius: '10px', overflow: 'hidden' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, px: 2, py: 1, bgcolor: '#f1f4fa' }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>Cliente encontrado</Typography>
                  <Box component="span" sx={{ fontSize: 12, fontWeight: 600, px: 1.25, py: 0.25, borderRadius: '20px', bgcolor: '#fde0e0', color: '#b42318' }}>{cliente.status}</Box>
                </Box>
                <Table size="small">
                  <TableBody>
                    {filas.map(([k, v], i) => (
                      <TableRow key={k} sx={i === filas.length - 1 ? { '& td': { borderBottom: 0 } } : undefined}>
                        <TableCell sx={{ width: '45%', color: '#6b7280' }}>{k}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{v}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
              <Button variant="contained" fullWidth loading={liberar.isPending} onClick={() => liberar.mutate(cliente)} sx={{ mt: 2, height: 48, fontSize: 16, ...BOTON_DORADO }}>
                Liberar cliente
              </Button>
            </Box>
          )}
        </TarjetaConfig>
      </Box>

      <Dialog open={hecho !== null} onClose={aceptar} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: '16px' } } }}>
        <DialogContent sx={{ textAlign: 'center', p: 4 }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: '50%', bgcolor: '#d3f0e6', color: '#0b6b4f', fontSize: 28, fontWeight: 700, mb: 2 }}>✓</Box>
          <Typography sx={{ fontSize: 20, fontWeight: 600 }}>Número liberado correctamente</Typography>
          <Typography sx={{ fontSize: 13, color: '#6b7280', mt: 0.5 }}>{hecho?.nombre_legal} · C.I. {hecho?.identificacion}</Typography>
          <Button variant="contained" fullWidth onClick={aceptar} sx={{ mt: 3, height: 48 }}>Aceptar</Button>
        </DialogContent>
      </Dialog>
    </Pagina>
  );
}
