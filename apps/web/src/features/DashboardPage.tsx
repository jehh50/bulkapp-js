/**
 * Dashboard mensual con el diseño de `views/dashboard/index.php`: KPIs acumulados,
 * tarjetas por servicio (donas de contactabilidad y ventas + ventas por día) y la
 * vista «Comparativo» en tabla. El mes y el corte van en el hero.
 */
import { useState, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';
import { Box, ButtonBase, NativeSelect, Paper, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { FLUJO } from '@bulkapp/shared';
import { api } from '../shared/api.ts';
import { useCampanas } from '../shared/datos.tsx';
import { BarraProgreso, Kpi, RejillaKpi, SinDatos, TarjetaDatos, porcentajeTexto } from '../shared/graficos.tsx';
import { COLORES_GRAFICA, MARCA } from '../shared/tema.ts';
import { Consulta, Pagina, TarjetaHero, fechaLarga, hoy, numero } from '../shared/ui.tsx';

interface FilaServicio { id: number; nombre: string; gestionados: number; efectivos: number; ventas: number }
interface Dashboard {
  mes: string; desde: string; hasta: string; servicios: FilaServicio[]; diarias: Array<{ id: number; dia: string; ventas: number }>; meses: string[];
}

const nombreMes = (ym: string): string => {
  const texto = new Date(`${ym}-15T12:00:00Z`).toLocaleDateString('es-VE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

/** Días `AAAA-MM-DD` del rango consultado. */
function diasDelRango(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  for (let d = new Date(`${desde}T12:00:00Z`); d.toISOString().slice(0, 10) <= hasta; d.setUTCDate(d.getUTCDate() + 1)) dias.push(d.toISOString().slice(0, 10));
  return dias;
}

/** Dona pequeña de la tarjeta de servicio (`.svc__donut`). */
function DonaServicio({ grados, color, texto, etiqueta }: { grados: number; color: string; texto: string; etiqueta: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box
        role="img" aria-label={`${typeof etiqueta === 'string' ? etiqueta : '%'}: ${texto}`}
        sx={{ width: 92, height: 92, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', background: `conic-gradient(${color} ${grados}deg,#e5e9f2 0)` }}
      >
        <Box sx={{ width: 66, height: 66, borderRadius: '50%', bgcolor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>{texto}</Box>
      </Box>
      <Typography sx={{ fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', lineHeight: 1.3 }}>{etiqueta}</Typography>
    </Box>
  );
}

function TarjetaServicio({ s, color, dias, ventasDia, bancaria }: { s: FilaServicio; color: string; dias: string[]; ventasDia: Map<string, number>; bancaria: boolean }) {
  const cr = s.gestionados ? s.efectivos / s.gestionados : 0;
  const vr = s.efectivos ? s.ventas / s.efectivos : 0;
  const maxV = Math.max(0, ...dias.map((d) => ventasDia.get(d) ?? 0));
  const n = Math.max(1, dias.length);
  const hoyDia = hoy();
  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <Box sx={{ bgcolor: color, color: '#fff', px: 2.75, py: 1.75, fontSize: 16, fontWeight: 600 }}>{s.nombre.trim()}</Box>
      <Box sx={{ p: '24px 22px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.75 }}>
          <DonaServicio grados={Math.round(cr * 360)} color={MARCA.azul700} texto={porcentajeTexto(s.efectivos, s.gestionados)} etiqueta={<>% Contacta-<br />bilidad</>} />
          {/* Amplificado x3 para que se vea, como en el PHP. */}
          <DonaServicio grados={Math.round(Math.min(1, vr * 3) * 360)} color={MARCA.verde} texto={porcentajeTexto(s.ventas, s.efectivos)} etiqueta="% Ventas" />
        </Box>
        <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2.5, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 1.75 }}>
          <Box>
            <Typography sx={{ fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>Ventas acum.</Typography>
            <Typography sx={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1 }}>{numero(s.ventas)}</Typography>
          </Box>
          <Box aria-hidden sx={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: 64, flex: 1, maxWidth: 200 }}>
            {dias.map((d, k) => {
              const v = ventasDia.get(d) ?? 0;
              return (
                <Box
                  key={d} title={`${fechaLarga(d)}: ${v}`}
                  sx={{ flex: 1, minWidth: 0, bgcolor: MARCA.azul700, borderRadius: '2px 2px 0 0', height: `${maxV ? Math.max(6, Math.round((v / maxV) * 100)) : 6}%`, opacity: 0.35 + (0.65 * (k + 1)) / n }}
                />
              );
            })}
          </Box>
        </Box>
        {bancaria && (
          <ButtonBase
            component={RouterLink} to={`/reportes/acumulado?servicio_id=${s.id}&desde=${hoyDia}&hasta=${hoyDia}`}
            sx={{
              width: '100%', gap: 1, border: '1px solid #d7deee', bgcolor: '#fff', color: MARCA.azul700, borderRadius: '10px', py: 1.4, px: 1.75,
              fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, '&:hover': { bgcolor: '#eef2fb', borderColor: '#c3cee8' },
            }}
          >
            Ver acumulado de gestión de hoy →
          </ButtonBase>
        )}
      </Box>
    </Paper>
  );
}

function Comparativo({ servicios }: { servicios: FilaServicio[] }) {
  const t = servicios.reduce((a, s) => ({ g: a.g + s.gestionados, c: a.c + s.efectivos, v: a.v + s.ventas }), { g: 0, c: 0, v: 0 });
  const prog = (pct: number, color: string, texto: string) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
      <BarraProgreso pct={pct} color={color} />
      <Box component="span" sx={{ width: 58, textAlign: 'right', fontWeight: 500 }}>{texto}</Box>
    </Box>
  );
  return (
    <TarjetaDatos>
      <TableContainer>
        <Table sx={{ '& td, & th': { fontSize: 14 } }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ pl: 3 }}>Servicio</TableCell>
              <TableCell align="right">Gestionados</TableCell>
              <TableCell sx={{ width: '24%' }}>% Contactabilidad</TableCell>
              <TableCell sx={{ width: '24%' }}>% Ventas</TableCell>
              <TableCell align="right" sx={{ pr: 3 }}>Ventas acum.</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {servicios.map((s) => (
              <TableRow key={s.id} hover>
                <TableCell sx={{ pl: 3, fontWeight: 600 }}>{s.nombre.trim()}</TableCell>
                <TableCell align="right">{numero(s.gestionados)}</TableCell>
                <TableCell>{prog(s.gestionados ? (s.efectivos / s.gestionados) * 100 : 0, MARCA.azul700, porcentajeTexto(s.efectivos, s.gestionados))}</TableCell>
                <TableCell>{prog(s.efectivos ? Math.min(100, (s.ventas / s.efectivos) * 300) : 0, MARCA.verde, porcentajeTexto(s.ventas, s.efectivos))}</TableCell>
                <TableCell align="right" sx={{ pr: 3, fontWeight: 700, fontSize: '16px !important' }}>{numero(s.ventas)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell sx={{ pl: 3 }}>Total</TableCell>
              <TableCell align="right">{numero(t.g)}</TableCell>
              <TableCell>{porcentajeTexto(t.c, t.g)}</TableCell>
              <TableCell>{porcentajeTexto(t.v, t.c)}</TableCell>
              <TableCell align="right" sx={{ pr: 3 }}>{numero(t.v)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>
    </TarjetaDatos>
  );
}

export default function DashboardPage() {
  const [mes, setMes] = useState('');
  const [vista, setVista] = useState<'tarjetas' | 'comparativo'>('tarjetas');
  const consulta = useQuery({ queryKey: ['dashboard', mes], queryFn: () => api.get<Dashboard>('/reportes/dashboard', { mes }), placeholderData: (previo) => previo });
  const bancarias = useCampanas({ flujo: FLUJO.BANCARIO });
  const idsBancarios = new Set((bancarias.data ?? []).map((c) => c.id));

  return (
    <Pagina
      miga="Inicio / Dashboard" titulo="Acumulado del mes por servicio"
      indicadores={consulta.data && (
        <TarjetaHero
          etiqueta="Mes" periodo={null}
          valor={(
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <NativeSelect
                value={consulta.data.mes} onChange={(e) => setMes(e.target.value)} disableUnderline inputProps={{ 'aria-label': 'Mes' }}
                sx={{ color: '#fff', fontSize: 20, fontWeight: 700, fontFamily: 'inherit', '& svg': { color: '#fff' }, '& option': { color: MARCA.tinta } }}
              >
                {consulta.data.meses.map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}
              </NativeSelect>
              <Box sx={{ width: '1px', alignSelf: 'stretch', bgcolor: MARCA.azul600 }} />
              <Box>
                <Typography sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.8px', color: MARCA.tenue }}>Corte</Typography>
                <Typography sx={{ fontSize: 15, fontWeight: 500 }}>{fechaLarga(consulta.data.hasta)}</Typography>
              </Box>
            </Box>
          )}
        />
      )}
    >
      <Consulta query={consulta}>
        {(d) => {
          if (d.servicios.length === 0) return <SinDatos>No hay gestión registrada en {nombreMes(d.mes)}.</SinDatos>;
          const t = d.servicios.reduce((a, s) => ({ g: a.g + s.gestionados, c: a.c + s.efectivos, v: a.v + s.ventas }), { g: 0, c: 0, v: 0 });
          const dias = diasDelRango(d.desde, d.hasta);
          const porServicio = new Map<number, Map<string, number>>();
          for (const x of d.diarias) {
            const m = porServicio.get(x.id) ?? new Map<string, number>();
            m.set(x.dia, x.ventas);
            porServicio.set(x.id, m);
          }
          const n = d.servicios.length;
          return (
            <>
              <RejillaKpi>
                <Kpi etiqueta="% Contactabilidad acumulada" valor={porcentajeTexto(t.c, t.g)} color="#8a3fb0" sub={`${numero(t.c)} de ${numero(t.g)} gestionados`} />
                <Kpi etiqueta="% Ventas acumulada" valor={porcentajeTexto(t.v, t.c)} color={MARCA.verde} sub={`${numero(t.v)} sobre ${numero(t.c)} contactados`} />
                <Kpi etiqueta="Total ventas acumuladas" valor={numero(t.v)} color={MARCA.dorado} sub="todos los servicios" />
              </RejillaKpi>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
                <Typography sx={{ fontSize: 16, fontWeight: 600 }}>{n} servicio{n === 1 ? '' : 's'}</Typography>
                <Box role="group" aria-label="Vista" sx={{ display: 'inline-flex', bgcolor: '#e5e9f2', borderRadius: '10px', p: '3px', gap: '2px' }}>
                  {(['tarjetas', 'comparativo'] as const).map((v) => (
                    <ButtonBase
                      key={v} onClick={() => setVista(v)} aria-pressed={vista === v}
                      sx={{
                        height: 34, px: 2, borderRadius: '8px', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: MARCA.tinta,
                        bgcolor: vista === v ? '#fff' : 'transparent', boxShadow: vista === v ? '0 1px 2px rgba(16,24,40,.12)' : 'none',
                      }}
                    >
                      {v === 'tarjetas' ? 'Tarjetas' : 'Comparativo'}
                    </ButtonBase>
                  ))}
                </Box>
              </Box>

              {vista === 'tarjetas' ? (
                <Box
                  sx={{
                    display: 'grid', gap: 2, mb: 2.5,
                    // Con menos de 3 servicios las tarjetas se agrandan.
                    gridTemplateColumns: n === 1 ? 'minmax(0,640px)' : n === 2 ? { xs: '1fr', md: 'repeat(2,minmax(0,1fr))' } : 'repeat(auto-fill,minmax(min(100%,340px),1fr))',
                  }}
                >
                  {d.servicios.map((s, i) => (
                    <TarjetaServicio
                      key={s.id} s={s} color={COLORES_GRAFICA[i % COLORES_GRAFICA.length] ?? MARCA.azul900} dias={dias}
                      ventasDia={porServicio.get(s.id) ?? new Map()} bancaria={idsBancarios.has(s.id)}
                    />
                  ))}
                </Box>
              ) : <Comparativo servicios={d.servicios} />}
            </>
          );
        }}
      </Consulta>
    </Pagina>
  );
}
