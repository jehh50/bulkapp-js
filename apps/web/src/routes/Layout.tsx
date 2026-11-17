/**
 * Marco de la aplicación: barra superior con selector de campaña y menú lateral
 * filtrado por rol.
 */
import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router';
import {
  AppBar, Box, Divider, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, ListSubheader, MenuItem, TextField, Toolbar,
  Tooltip, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/AssessmentOutlined';
import BusinessIcon from '@mui/icons-material/BusinessOutlined';
import BuildIcon from '@mui/icons-material/DashboardCustomizeOutlined';
import CodeIcon from '@mui/icons-material/CodeOutlined';
import ContactsIcon from '@mui/icons-material/ContactsOutlined';
import DashboardIcon from '@mui/icons-material/SpaceDashboardOutlined';
import EditNoteIcon from '@mui/icons-material/EditNoteOutlined';
import InventoryIcon from '@mui/icons-material/Inventory2Outlined';
import KeyIcon from '@mui/icons-material/KeyOutlined';
import LogoutIcon from '@mui/icons-material/LogoutOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import PeopleIcon from '@mui/icons-material/PeopleAltOutlined';
import PointOfSaleIcon from '@mui/icons-material/PointOfSaleOutlined';
import TableViewIcon from '@mui/icons-material/TableViewOutlined';
import { ROLES, ROLES_ADMIN, ROLES_SUPERVISION, ROL_NOMBRE, type Rol } from '@bulkapp/shared';
import { useSesion, useUsuario } from '../shared/auth.tsx';
import { useAvisos } from '../shared/ui.tsx';

const ANCHO = 264;

interface Enlace { a: string; texto: string; icono: ReactNode; roles: readonly Rol[] }
const MENU: Array<{ titulo: string; enlaces: Enlace[] }> = [
  { titulo: 'Operación', enlaces: [
    { a: '/', texto: 'Formulario de gestión', icono: <EditNoteIcon />, roles: ROLES },
    { a: '/dashboard', texto: 'Dashboard', icono: <DashboardIcon />, roles: ROLES_SUPERVISION },
  ] },
  { titulo: 'Reportes', enlaces: [
    { a: '/reportes/acumulado', texto: 'Acumulado de gestión', icono: <AssessmentIcon />, roles: ROLES_SUPERVISION },
    { a: '/reportes/ventas', texto: 'Ventas', icono: <PointOfSaleIcon />, roles: ROLES_SUPERVISION },
    { a: '/reportes/formularios', texto: 'Formularios dinámicos', icono: <TableViewIcon />, roles: ROLES_SUPERVISION },
    { a: '/xml', texto: 'Generar XML', icono: <CodeIcon />, roles: ROLES_SUPERVISION },
  ] },
  { titulo: 'Configuración', enlaces: [
    { a: '/admin/usuarios', texto: 'Usuarios', icono: <PeopleIcon />, roles: ROLES_SUPERVISION },
    { a: '/admin/productos', texto: 'Productos', icono: <InventoryIcon />, roles: ROLES_SUPERVISION },
    { a: '/admin/clientes', texto: 'Clientes y ventas', icono: <ContactsIcon />, roles: ROLES_SUPERVISION },
    { a: '/organizacion', texto: 'Empresas y campañas', icono: <BusinessIcon />, roles: ROLES_ADMIN },
    { a: '/constructor', texto: 'Constructor de formularios', icono: <BuildIcon />, roles: ROLES_ADMIN },
  ] },
];

export function Layout({ children }: { children: ReactNode }) {
  const usuario = useUsuario();
  const { logout, cambiarCampana } = useSesion();
  const avisos = useAvisos();
  const navegar = useNavigate();
  const tema = useTheme();
  const escritorio = useMediaQuery(tema.breakpoints.up('md'));
  const [abierto, setAbierto] = useState(false);

  const alCambiarCampana = async (id: number) => {
    try {
      await cambiarCampana(id);
      await navegar('/');
    } catch (e) {
      avisos.error(e);
    }
  };

  const menu = (
    <Box component="nav" aria-label="Menú principal" sx={{ overflowY: 'auto', flex: 1 }}>
      {MENU.map((grupo) => {
        const enlaces = grupo.enlaces.filter((e) => e.roles.includes(usuario.rol));
        if (enlaces.length === 0) return null;
        return (
          <List key={grupo.titulo} dense subheader={<ListSubheader sx={{ lineHeight: '36px' }}>{grupo.titulo}</ListSubheader>}>
            {enlaces.map((e) => (
              <ListItemButton
                key={e.a} component={NavLink} to={e.a} end={e.a === '/'} onClick={() => setAbierto(false)}
                sx={{ mx: 1, borderRadius: 2, '&.active': { bgcolor: 'primary.main', color: 'primary.contrastText', '& .MuiListItemIcon-root': { color: 'inherit' } } }}
              >
                <ListItemIcon sx={{ minWidth: 38 }}>{e.icono}</ListItemIcon>
                <ListItemText primary={e.texto} />
              </ListItemButton>
            ))}
          </List>
        );
      })}
    </Box>
  );

  const lateral = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ gap: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 1, color: 'primary.dark' }}>BULKSALES</Typography>
      </Toolbar>
      <Divider />
      {menu}
      <Divider />
      <List dense>
        <ListItemButton component={NavLink} to="/cuenta/password" onClick={() => setAbierto(false)}>
          <ListItemIcon sx={{ minWidth: 38 }}><KeyIcon /></ListItemIcon>
          <ListItemText primary="Cambiar contraseña" />
        </ListItemButton>
        <ListItemButton onClick={() => void logout()}>
          <ListItemIcon sx={{ minWidth: 38 }}><LogoutIcon /></ListItemIcon>
          <ListItemText primary="Cerrar sesión" />
        </ListItemButton>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', width: { md: `calc(100% - ${ANCHO}px)` }, ml: { md: `${ANCHO}px` } }}>
        <Toolbar sx={{ gap: 2 }}>
          {!escritorio && (
            <IconButton edge="start" aria-label="Abrir menú" onClick={() => setAbierto(true)}><MenuIcon /></IconButton>
          )}
          <TextField
            select size="small" label="Campaña activa" value={usuario.servicioId}
            onChange={(e) => void alCambiarCampana(Number(e.target.value))}
            disabled={usuario.campanas.length <= 1}
            sx={{ minWidth: { xs: 170, sm: 280 }, maxWidth: 380 }}
          >
            {usuario.campanas.some((c) => c.id === usuario.servicioId) ? null : <MenuItem value={usuario.servicioId}>Campaña #{usuario.servicioId}</MenuItem>}
            {usuario.campanas.map((c) => <MenuItem key={c.id} value={c.id}>{c.etiqueta}</MenuItem>)}
          </TextField>
          <Box sx={{ flex: 1 }} />
          <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>{usuario.nombre} {usuario.apellido}</Typography>
            <Typography variant="caption" color="text.secondary">{ROL_NOMBRE[usuario.rol]} · {usuario.username}</Typography>
          </Box>
          <Tooltip title="Cerrar sesión">
            <IconButton aria-label="Cerrar sesión" onClick={() => void logout()}><LogoutIcon /></IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={escritorio ? 'permanent' : 'temporary'} open={escritorio || abierto} onClose={() => setAbierto(false)}
        sx={{ width: { md: ANCHO }, flexShrink: 0, '& .MuiDrawer-paper': { width: ANCHO, boxSizing: 'border-box' } }}
      >
        {lateral}
      </Drawer>

      <Box component="main" sx={{ flex: 1, minWidth: 0, p: { xs: 2, sm: 3 } }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
