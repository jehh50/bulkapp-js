/**
 * Marco de la aplicación con el aspecto de `nnavbar.php`: barra superior azul con
 * menús desplegables (filtrados por rol), selector de campaña y menú de usuario.
 * El hero de cada pantalla lo dibuja `<Pagina>`.
 */
import { Fragment, useState, type MouseEvent, type ReactNode } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router';
import {
  AppBar, Box, ButtonBase, Collapse, Divider, IconButton, List, ListItemButton, ListItemText, ListSubheader, Menu, MenuItem, Toolbar,
  useMediaQuery, useTheme,
} from '@mui/material';
import CampaignIcon from '@mui/icons-material/CampaignOutlined';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MenuIcon from '@mui/icons-material/Menu';
import { ROL_NOMBRE } from '@bulkapp/shared';
import { useSesion, useUsuario } from '../shared/auth.tsx';
import { MENU, bloquesVisibles, enlaceActivo, esGrupo, type Enlace } from '../shared/menu.ts';
import { MARCA } from '../shared/tema.ts';
import { useAvisos } from '../shared/ui.tsx';

const ALTO = 56;

/** Estilo de un elemento de la barra (`.app-nav .nav-link`). */
const estiloEnlace = (activo: boolean) => ({
  height: ALTO,
  px: 1.5,
  gap: 0.5,
  fontFamily: 'inherit',
  fontSize: 14,
  fontWeight: activo ? 600 : 500,
  color: activo ? '#fff' : MARCA.tenue,
  boxShadow: activo ? `inset 0 -3px 0 ${MARCA.dorado}` : 'none',
  whiteSpace: 'nowrap',
  '&:hover, &:focus-visible': { color: '#fff' },
});

/** Panel desplegable (`.app-nav .dropdown-menu`): esquinas inferiores redondeadas. */
const panelMenu = {
  paper: {
    sx: {
      mt: 0, minWidth: 240, borderRadius: '0 0 12px 12px', boxShadow: '0 12px 24px rgba(0,0,0,.25)',
      '& .MuiMenuItem-root': { py: 1.25, px: 1.75, fontSize: 14 },
      '& .MuiMenuItem-root:hover': { bgcolor: 'rgba(245,184,61,.25)' },
      '& .MuiMenuItem-root.Mui-selected': { bgcolor: 'rgba(245,184,61,.22)', fontWeight: 600 },
    },
  },
} as const;

function Desplegable({ etiqueta, activo, children }: { etiqueta: ReactNode; activo?: boolean; children: (cerrar: () => void) => ReactNode }) {
  const [ancla, setAncla] = useState<HTMLElement | null>(null);
  const cerrar = () => setAncla(null);
  return (
    <>
      <ButtonBase
        sx={estiloEnlace(activo ?? false)} aria-haspopup="menu" aria-expanded={ancla !== null}
        onClick={(e: MouseEvent<HTMLElement>) => setAncla(e.currentTarget)}
      >
        {etiqueta}<ExpandMoreIcon sx={{ fontSize: 18 }} />
      </ButtonBase>
      <Menu
        anchorEl={ancla} open={ancla !== null} onClose={cerrar} slotProps={panelMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {children(cerrar)}
      </Menu>
    </>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const usuario = useUsuario();
  const { logout, cambiarCampana } = useSesion();
  const avisos = useAvisos();
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const tema = useTheme();
  const escritorio = useMediaQuery(tema.breakpoints.up('md'));
  const [movilAbierto, setMovilAbierto] = useState(false);

  const entradas = MENU.filter((e) => e.roles.includes(usuario.rol));
  const campanaActual = usuario.campanas.find((c) => c.id === usuario.servicioId);

  const alCambiarCampana = async (id: number) => {
    if (id === usuario.servicioId) return;
    try {
      await cambiarCampana(id);
      await navegar('/');
    } catch (e) {
      avisos.error(e);
    }
  };

  const itemMenu = (e: Enlace, cerrar: () => void) => (
    <MenuItem key={e.a} component={RouterLink} to={e.a} selected={enlaceActivo(e, pathname)} onClick={cerrar}>{e.texto}</MenuItem>
  );

  const barraEscritorio = (
    <Box component="nav" aria-label="Menú principal" sx={{ display: 'flex', alignItems: 'stretch', ml: 'auto' }}>
      {entradas.map((e) => {
        if (!esGrupo(e)) {
          return <ButtonBase key={e.a} component={RouterLink} to={e.a} sx={estiloEnlace(enlaceActivo(e, pathname))}>{e.texto}</ButtonBase>;
        }
        const bloques = bloquesVisibles(e, usuario.rol);
        const activo = bloques.flat().some((x) => enlaceActivo(x, pathname));
        return (
          <Desplegable key={e.titulo} etiqueta={e.titulo} activo={activo}>
            {(cerrar) => bloques.map((b, i) => (
              <Fragment key={i}>
                {i > 0 && <Divider />}
                {b.map((x) => itemMenu(x, cerrar))}
              </Fragment>
            ))}
          </Desplegable>
        );
      })}

      {usuario.campanas.length > 1 && (
        <Desplegable etiqueta={<><CampaignIcon sx={{ fontSize: 18, mr: 0.5 }} />{campanaActual?.etiqueta ?? 'Campaña'}</>}>
          {(cerrar) => [
            <ListSubheader key="t" sx={{ lineHeight: '36px', fontSize: 12 }}>Cambiar de campaña</ListSubheader>,
            ...usuario.campanas.map((c) => (
              <MenuItem key={c.id} selected={c.id === usuario.servicioId} onClick={() => { cerrar(); void alCambiarCampana(c.id); }}>{c.etiqueta}</MenuItem>
            )),
          ]}
        </Desplegable>
      )}

      <Desplegable etiqueta={<Box component="span" sx={{ color: '#fff' }}>{usuario.username}</Box>}>
        {(cerrar) => [
          <ListSubheader key="t" sx={{ lineHeight: 1.4, py: 1, fontSize: 12 }}>
            {usuario.nombre} {usuario.apellido}<br />{ROL_NOMBRE[usuario.rol]}
          </ListSubheader>,
          <MenuItem key="p" component={RouterLink} to="/cuenta/password" onClick={cerrar}>Cambiar contraseña</MenuItem>,
          <MenuItem key="s" onClick={() => { cerrar(); void logout(); }}>Salir</MenuItem>,
        ]}
      </Desplegable>
    </Box>
  );

  // En móvil el menú se despliega bajo la barra, como el `navbar-collapse` de Bootstrap.
  const cerrarMovil = () => setMovilAbierto(false);
  const enlaceMovil = (e: Enlace) => {
    const activo = enlaceActivo(e, pathname);
    return (
      <ListItemButton
        key={e.a} component={RouterLink} to={e.a} onClick={cerrarMovil}
        sx={{ pl: 3, color: activo ? '#fff' : MARCA.tenue, fontWeight: activo ? 600 : 400, boxShadow: activo ? `inset 4px 0 0 ${MARCA.dorado}` : 'none' }}
      >
        <ListItemText primary={e.texto} slotProps={{ primary: { sx: { fontWeight: 'inherit', fontSize: 14 } } }} />
      </ListItemButton>
    );
  };
  const subtitulo = (texto: string) => (
    <ListSubheader sx={{ bgcolor: 'transparent', color: MARCA.tenue, lineHeight: '32px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.8px' }}>{texto}</ListSubheader>
  );
  const menuMovil = (
    <Collapse in={movilAbierto} unmountOnExit>
      <Box component="nav" aria-label="Menú principal" sx={{ bgcolor: MARCA.azul900, boxShadow: '0 12px 20px rgba(0,0,0,.25)', pb: 1 }}>
        <List dense disablePadding>
          {entradas.map((e) => (esGrupo(e) ? (
            <Fragment key={e.titulo}>
              {subtitulo(e.titulo)}
              {bloquesVisibles(e, usuario.rol).flat().map(enlaceMovil)}
            </Fragment>
          ) : enlaceMovil(e)))}
          {usuario.campanas.length > 1 && (
            <>
              {subtitulo('Campaña activa')}
              {usuario.campanas.map((c) => {
                const activa = c.id === usuario.servicioId;
                return (
                  <ListItemButton
                    key={c.id} onClick={() => { cerrarMovil(); void alCambiarCampana(c.id); }}
                    sx={{ pl: 3, color: activa ? '#fff' : MARCA.tenue, boxShadow: activa ? `inset 4px 0 0 ${MARCA.dorado}` : 'none' }}
                  >
                    <ListItemText primary={c.etiqueta} slotProps={{ primary: { sx: { fontSize: 14, fontWeight: activa ? 600 : 400 } } }} />
                  </ListItemButton>
                );
              })}
            </>
          )}
          {subtitulo(usuario.username)}
          {enlaceMovil({ a: '/cuenta/password', texto: 'Cambiar contraseña', roles: [] })}
          <ListItemButton onClick={() => { cerrarMovil(); void logout(); }} sx={{ pl: 3, color: MARCA.tenue }}>
            <ListItemText primary="Salir" slotProps={{ primary: { sx: { fontSize: 14 } } }} />
          </ListItemButton>
        </List>
      </Box>
    </Collapse>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: MARCA.azul900, zIndex: (t) => t.zIndex.appBar }}>
        <Toolbar disableGutters sx={{ minHeight: `${ALTO}px !important`, px: { xs: 2, md: 4 } }}>
          <Box
            component={RouterLink} to="/"
            sx={{ display: 'flex', alignItems: 'center', gap: 1.25, color: '#fff', fontWeight: 700, fontSize: 18, textDecoration: 'none' }}
          >
            <Box
              component="span"
              sx={{ width: 28, height: 28, borderRadius: '8px', bgcolor: MARCA.dorado, color: MARCA.azul900, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}
            >
              B
            </Box>
            Bulksales
          </Box>
          {escritorio ? barraEscritorio : (
            <IconButton
              aria-label={movilAbierto ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={movilAbierto} onClick={() => setMovilAbierto((v) => !v)}
              sx={{ ml: 'auto', color: '#fff', border: `1px solid ${MARCA.azul600}`, borderRadius: '10px', width: 44, height: 44 }}
            >
              {movilAbierto ? <CloseIcon /> : <MenuIcon />}
            </IconButton>
          )}
        </Toolbar>
        {!escritorio && menuMovil}
      </AppBar>

      <Box component="main">{children}</Box>
    </Box>
  );
}
