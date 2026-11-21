/**
 * Rutas con guardas por sesión, rol y flujo de la campaña activa.
 */
import { Suspense, lazy, type ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import { Box, Button, Paper, Typography } from '@mui/material';
import { FLUJO, ROLES_ADMIN, ROLES_SUPERVISION, type Flujo, type Rol } from '@bulkapp/shared';
import { useSesion, useUsuario } from '../shared/auth.tsx';
import { Cargando } from '../shared/ui.tsx';
import { Layout } from './Layout.tsx';

const LoginPage = lazy(() => import('../features/LoginPage.tsx'));
const CapturaBancariaPage = lazy(() => import('../features/CapturaBancariaPage.tsx'));
const CapturaDinamicaPage = lazy(() => import('../features/CapturaDinamicaPage.tsx'));
const DashboardPage = lazy(() => import('../features/DashboardPage.tsx'));
const AcumuladoPage = lazy(() => import('../features/AcumuladoPage.tsx'));
const VentasPage = lazy(() => import('../features/VentasPage.tsx'));
const DetalleVentasPage = lazy(() => import('../features/DetalleVentasPage.tsx'));
const ReporteFormulariosPage = lazy(() => import('../features/ReporteFormulariosPage.tsx'));
const XmlPage = lazy(() => import('../features/XmlPage.tsx'));
const UsuariosPage = lazy(() => import('../features/UsuariosPage.tsx'));
const ProductosPage = lazy(() => import('../features/ProductosPage.tsx'));
const CargaBbddPage = lazy(() => import('../features/CargaBbddPage.tsx'));
const ResultadosPage = lazy(() => import('../features/ResultadosPage.tsx'));
const LiberarPage = lazy(() => import('../features/LiberarPage.tsx'));
const EmpresasPage = lazy(() => import('../features/EmpresasPage.tsx'));
const ConstructorPage = lazy(() => import('../features/ConstructorPage.tsx'));
const PasswordPage = lazy(() => import('../features/PasswordPage.tsx'));

/** Pantalla inicial según el flujo de la campaña activa. */
export const inicioDe = (flujo: Flujo): string => (flujo === FLUJO.BANCARIO ? '/captura/bancaria' : '/captura/formulario');

function Aviso({ titulo, texto, children }: { titulo: string; texto: string; children?: ReactNode }) {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '60vh', p: 2 }}>
      <Paper variant="outlined" sx={{ p: 4, maxWidth: 440, textAlign: 'center', borderTop: 4, borderTopColor: 'secondary.main' }}>
        <Typography variant="h5" component="h1" gutterBottom>{titulo}</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>{texto}</Typography>
        {children}
      </Paper>
    </Box>
  );
}

function Protegida() {
  const { estado } = useSesion();
  const ubicacion = useLocation();
  if (estado.fase === 'cargando') return <Cargando texto="Restaurando la sesión…" />;
  if (estado.fase === 'anonimo') return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />;
  return (
    <Layout>
      <Suspense fallback={<Cargando />}>
        <Outlet />
      </Suspense>
    </Layout>
  );
}

function SoloRoles({ roles }: { roles: readonly Rol[] }) {
  const usuario = useUsuario();
  if (roles.includes(usuario.rol)) return <Outlet />;
  return (
    <Aviso titulo="Acceso restringido" texto="No tienes permiso para acceder a esta sección.">
      <Button variant="contained" href={inicioDe(usuario.tipoFlujo)}>Ir al formulario</Button>
    </Aviso>
  );
}

/** Si la campaña activa usa el otro flujo, lleva a su pantalla de captura. */
function SoloFlujo({ flujo }: { flujo: Flujo }) {
  const usuario = useUsuario();
  return usuario.tipoFlujo === flujo ? <Outlet /> : <Navigate to={inicioDe(usuario.tipoFlujo)} replace />;
}

function Inicio() {
  return <Navigate to={inicioDe(useUsuario().tipoFlujo)} replace />;
}

function Publica() {
  const { estado } = useSesion();
  if (estado.fase === 'cargando') return <Cargando texto="Restaurando la sesión…" />;
  if (estado.fase === 'autenticado') return <Navigate to={inicioDe(estado.usuario.tipoFlujo)} replace />;
  return (
    <Suspense fallback={<Cargando />}>
      <LoginPage />
    </Suspense>
  );
}

export function Rutas() {
  return (
    <Routes>
      <Route path="/login" element={<Publica />} />
      <Route element={<Protegida />}>
        <Route index element={<Inicio />} />
        <Route element={<SoloFlujo flujo={FLUJO.BANCARIO} />}>
          <Route path="captura/bancaria" element={<CapturaBancariaPage />} />
        </Route>
        <Route element={<SoloFlujo flujo={FLUJO.DINAMICO} />}>
          <Route path="captura/formulario" element={<CapturaDinamicaPage />} />
        </Route>
        <Route path="cuenta/password" element={<PasswordPage />} />

        <Route element={<SoloRoles roles={ROLES_SUPERVISION} />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="reportes/acumulado" element={<AcumuladoPage />} />
          <Route path="reportes/ventas" element={<VentasPage />} />
          <Route path="reportes/detalle-ventas" element={<DetalleVentasPage />} />
          <Route path="reportes/formularios" element={<ReporteFormulariosPage />} />
          <Route path="xml" element={<XmlPage />} />
          <Route path="admin/usuarios" element={<UsuariosPage />} />
          <Route path="admin/productos" element={<ProductosPage />} />
          <Route path="admin/usuarios/nuevo" element={<UsuariosPage alta />} />
          <Route path="admin/carga" element={<CargaBbddPage />} />
          <Route path="admin/resultados" element={<ResultadosPage />} />
          <Route path="reportes/liberar" element={<LiberarPage />} />
          <Route path="admin/clientes" element={<Navigate to="/admin/carga" replace />} />
        </Route>

        <Route element={<SoloRoles roles={ROLES_ADMIN} />}>
          <Route path="organizacion" element={<EmpresasPage />} />
          <Route path="constructor" element={<ConstructorPage />} />
        </Route>

        <Route path="*" element={<Aviso titulo="Página no encontrada" texto="La dirección que abriste no existe o cambió de lugar." />} />
      </Route>
    </Routes>
  );
}
