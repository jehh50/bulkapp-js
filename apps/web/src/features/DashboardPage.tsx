/**
 * Dashboard mensual por campaña: gestionados, contactos efectivos y ventas, con
 * la evolución diaria de ventas.
 */
import { useState } from 'react';
import { Stack } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { useQuery } from '@tanstack/react-query';
import { api } from '../shared/api.ts';
import { Tabla } from '../shared/datos.tsx';
import { Consulta, Indicador, Pagina, Seccion, Selector, Vacio, fechaLarga, numero } from '../shared/ui.tsx';

interface FilaServicio { id: number; nombre: string; gestionados: number; efectivos: number; ventas: number }
interface Dashboard {
  mes: string; desde: string; hasta: string; servicios: FilaServicio[]; diarias: Array<{ id: number; dia: string; ventas: number }>; meses: string[];
}

/** Series con los colores de marca: azul (volumen), dorado (contacto), verde (venta). */
const COLORES = ['#1a4391', '#f5b83d', '#0f9d75', '#7a5cc4', '#d9534f'];

const nombreMes = (ym: string): string => {
  const texto = new Date(`${ym}-15T12:00:00Z`).toLocaleDateString('es-VE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};
const porcentaje = (parte: number, total: number): string => (total > 0 ? `${((parte / total) * 100).toFixed(1)} %` : '—');

export default function DashboardPage() {
  const [mes, setMes] = useState('');
  const consulta = useQuery({ queryKey: ['dashboard', mes], queryFn: () => api.get<Dashboard>('/reportes/dashboard', { mes }), placeholderData: (previo) => previo });

  return (
    <Pagina titulo="Dashboard" subtitulo="Acumulado del mes por campaña. En el mes en curso, el corte es el día de hoy.">
      <Consulta query={consulta}>
        {(d) => {
          const total = d.servicios.reduce((t, s) => ({ g: t.g + s.gestionados, e: t.e + s.efectivos, v: t.v + s.ventas }), { g: 0, e: 0, v: 0 });
          const dias = [...new Set(d.diarias.map((x) => x.dia))].sort();
          const series = d.servicios.filter((s) => d.diarias.some((x) => x.id === s.id)).map((s) => ({
            label: s.nombre, curve: 'linear' as const, showMark: dias.length <= 31,
            data: dias.map((dia) => d.diarias.find((x) => x.id === s.id && x.dia === dia)?.ventas ?? 0),
          }));
          return (
            <Stack spacing={3}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'stretch' } }}>
                <Selector
                  label="Mes" value={d.mes} onChange={(e) => setMes(e.target.value)} sx={{ maxWidth: { sm: 220 }, alignSelf: 'center' }}
                  opciones={d.meses.map((m) => ({ value: m, label: nombreMes(m) }))}
                />
                <Indicador etiqueta="Gestionados" valor={numero(total.g)} />
                <Indicador etiqueta="Contactos efectivos" valor={numero(total.e)} color="secondary.main" />
                <Indicador etiqueta="Ventas" valor={numero(total.v)} color="success.main" />
              </Stack>

              <Seccion titulo={`Resultado por campaña · ${fechaLarga(d.desde)} – ${fechaLarga(d.hasta)}`}>
                {d.servicios.length === 0 ? <Vacio>No hay gestión registrada en este mes.</Vacio> : (
                  <>
                    <BarChart
                      height={300} colors={COLORES}
                      xAxis={[{ scaleType: 'band', data: d.servicios.map((s) => s.nombre) }]}
                      series={[
                        { label: 'Gestionados', data: d.servicios.map((s) => s.gestionados) },
                        { label: 'Efectivos', data: d.servicios.map((s) => s.efectivos) },
                        { label: 'Ventas', data: d.servicios.map((s) => s.ventas) },
                      ]}
                    />
                    <Tabla
                      filas={d.servicios} clave={(s) => s.id}
                      columnas={[
                        { titulo: 'Campaña', celda: (s) => s.nombre },
                        { titulo: 'Gestionados', numerica: true, celda: (s) => numero(s.gestionados) },
                        { titulo: 'Efectivos', numerica: true, celda: (s) => numero(s.efectivos) },
                        { titulo: '% Contacto', numerica: true, celda: (s) => porcentaje(s.efectivos, s.gestionados) },
                        { titulo: 'Ventas', numerica: true, celda: (s) => numero(s.ventas) },
                        { titulo: '% Conversión', numerica: true, celda: (s) => porcentaje(s.ventas, s.efectivos) },
                      ]}
                    />
                  </>
                )}
              </Seccion>

              <Seccion titulo="Ventas por día">
                {series.length === 0 ? <Vacio>No hay ventas en este mes.</Vacio> : (
                  <LineChart height={300} colors={COLORES} xAxis={[{ scaleType: 'point', data: dias.map((dia) => dia.slice(8)) }]} series={series} />
                )}
              </Seccion>
            </Stack>
          );
        }}
      </Consulta>
    </Pagina>
  );
}
