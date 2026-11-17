/**
 * Reportes de ventas: por estado (con detalle por ciudad) y detalle exportable.
 */
import { useState, type FormEvent } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, Link, Stack, Tab, Tabs } from '@mui/material';
import DownloadIcon from '@mui/icons-material/DownloadOutlined';
import { useQuery } from '@tanstack/react-query';
import { FLUJO } from '@bulkapp/shared';
import { api } from '../shared/api.ts';
import { Tabla, opcionesCampana, useCampanas } from '../shared/datos.tsx';
import { CampoFecha, Consulta, Pagina, Seccion, Selector, Vacio, fechaLarga, hoy, numero, useAvisos } from '../shared/ui.tsx';

interface Filtro { desde: string; hasta: string; servicio_id: string }
interface FilaEstado { id: number; estado: string; total: number }
interface FilaCiudad { id: number; ciudad: string; total: number }
interface Venta {
  nombre: string; apellido: string; cedula: string; fecha_nacimiento: string | null; telf_hab: string; telf_celular: string; correo: string;
  producto: string | null; agente: string; fecha_venta: string;
}

function Filtros({ borrador, setBorrador, campanaObligatoria, ocupado, onConsultar }: {
  borrador: Filtro; setBorrador: (f: Filtro) => void; campanaObligatoria: boolean; ocupado: boolean; onConsultar: () => void;
}) {
  const campanas = useCampanas({ flujo: FLUJO.BANCARIO, activas: true });
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    onConsultar();
  };
  return (
    <Seccion>
      <Grid container spacing={2} component="form" onSubmit={enviar} sx={{ alignItems: 'center' }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><CampoFecha label="Desde" value={borrador.desde} required onChange={(e) => setBorrador({ ...borrador, desde: e.target.value })} /></Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><CampoFecha label="Hasta" value={borrador.hasta} required onChange={(e) => setBorrador({ ...borrador, hasta: e.target.value })} /></Grid>
        <Grid size={{ xs: 12, sm: 8, md: 4 }}>
          <Selector
            label="Campaña" value={borrador.servicio_id} opciones={opcionesCampana(campanas.data)} required={campanaObligatoria}
            vacio={campanaObligatoria ? 'Selecciona…' : 'Todas'} onChange={(e) => setBorrador({ ...borrador, servicio_id: e.target.value })}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4, md: 2 }}>
          <Button type="submit" variant="contained" fullWidth loading={ocupado} disabled={campanaObligatoria && borrador.servicio_id === ''}>Consultar</Button>
        </Grid>
      </Grid>
    </Seccion>
  );
}

function PorEstado() {
  const [borrador, setBorrador] = useState<Filtro>({ desde: hoy(), hasta: hoy(), servicio_id: '' });
  const [filtro, setFiltro] = useState<Filtro | null>(null);
  const [estado, setEstado] = useState<FilaEstado | null>(null);
  const reporte = useQuery({
    queryKey: ['reportes', 'ventas-estado', filtro], enabled: filtro !== null,
    queryFn: () => api.get<{ filas: FilaEstado[] }>('/reportes/ventas-estado', { ...filtro }),
  });
  const ciudades = useQuery({
    queryKey: ['reportes', 'ventas-ciudad', filtro, estado?.id], enabled: filtro !== null && estado !== null,
    queryFn: () => api.get<{ estado: string; filas: FilaCiudad[] }>('/reportes/ventas-ciudad', { ...filtro, estado_id: estado?.id }),
  });

  return (
    <Stack spacing={3}>
      <Filtros borrador={borrador} setBorrador={setBorrador} campanaObligatoria={false} ocupado={reporte.isFetching} onConsultar={() => setFiltro({ ...borrador })} />
      {filtro === null ? <Vacio>Elige el rango de fechas para consultar.</Vacio> : (
        <Consulta query={reporte}>
          {(r) => (
            <Seccion titulo={`Ventas por estado · ${numero(r.filas.reduce((t, f) => t + f.total, 0))} en total`}>
              <Tabla
                filas={r.filas} clave={(f) => f.id} vacio="No hay ventas en el rango consultado."
                columnas={[
                  { titulo: 'Estado', celda: (f) => <Link component="button" type="button" onClick={() => setEstado(f)}>{f.estado.trim()}</Link> },
                  { titulo: 'Ventas', numerica: true, celda: (f) => numero(f.total) },
                ]}
              />
            </Seccion>
          )}
        </Consulta>
      )}
      <Dialog open={estado !== null} onClose={() => setEstado(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Ventas por ciudad · {estado?.estado.trim()}</DialogTitle>
        <DialogContent dividers>
          <Consulta query={ciudades}>
            {(c) => (
              <Tabla
                filas={c.filas} clave={(f) => f.id}
                columnas={[{ titulo: 'Ciudad', celda: (f) => f.ciudad.trim() }, { titulo: 'Ventas', numerica: true, celda: (f) => numero(f.total) }]}
              />
            )}
          </Consulta>
        </DialogContent>
        <DialogActions><Button onClick={() => setEstado(null)}>Cerrar</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}

function Detalle() {
  const avisos = useAvisos();
  const [borrador, setBorrador] = useState<Filtro>({ desde: hoy(), hasta: hoy(), servicio_id: '' });
  const [filtro, setFiltro] = useState<Filtro | null>(null);
  const [descargando, setDescargando] = useState(false);
  const reporte = useQuery({
    queryKey: ['reportes', 'detalle-ventas', filtro], enabled: filtro !== null,
    queryFn: () => api.get<{ filas: Venta[] }>('/reportes/detalle-ventas', { ...filtro }),
  });

  const exportar = async () => {
    if (!filtro) return;
    setDescargando(true);
    try {
      await api.descargar('/reportes/detalle-ventas/exportar', { ...filtro });
    } catch (e) {
      avisos.error(e);
    } finally {
      setDescargando(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Filtros borrador={borrador} setBorrador={setBorrador} campanaObligatoria ocupado={reporte.isFetching} onConsultar={() => setFiltro({ ...borrador })} />
      {filtro === null ? <Vacio>Elige el rango y la campaña para consultar.</Vacio> : (
        <Consulta query={reporte}>
          {(r) => (
            <Seccion
              titulo={`${numero(r.filas.length)} ventas`}
              acciones={<Button startIcon={<DownloadIcon />} variant="outlined" onClick={() => void exportar()} loading={descargando} disabled={r.filas.length === 0}>Descargar Excel</Button>}
            >
              <Tabla
                filas={r.filas} clave={(_v, i) => i} vacio="No hay ventas en el rango consultado."
                columnas={[
                  { titulo: 'Nombre', celda: (v) => `${v.nombre} ${v.apellido}` },
                  { titulo: 'Cédula', celda: (v) => v.cedula },
                  { titulo: 'Nacimiento', celda: (v) => fechaLarga(v.fecha_nacimiento ?? '') },
                  { titulo: 'Teléfono 1', celda: (v) => v.telf_hab },
                  { titulo: 'Teléfono 2', celda: (v) => v.telf_celular },
                  { titulo: 'Correo', celda: (v) => v.correo },
                  { titulo: 'Producto', celda: (v) => v.producto ?? '' },
                  { titulo: 'Agente', celda: (v) => v.agente },
                  { titulo: 'Fecha', celda: (v) => fechaLarga(v.fecha_venta) },
                ]}
              />
            </Seccion>
          )}
        </Consulta>
      )}
    </Stack>
  );
}

export default function VentasPage() {
  const [pestana, setPestana] = useState<'estado' | 'detalle'>('estado');
  return (
    <Pagina titulo="Ventas" subtitulo="Ventas por estado geográfico y detalle exportable a Excel.">
      <Tabs value={pestana} onChange={(_e, v: 'estado' | 'detalle') => setPestana(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="estado" label="Por estado" />
        <Tab value="detalle" label="Detalle de ventas" />
      </Tabs>
      {pestana === 'estado' ? <PorEstado /> : <Detalle />}
    </Pagina>
  );
}
