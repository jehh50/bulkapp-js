/**
 * Inicio de sesión con el diseño de `views/login/index.php`: panel azul de marca a la
 * izquierda y formulario sobre gris claro a la derecha.
 */
import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, InputAdornment, InputLabel, Link, Stack, TextField, Typography } from '@mui/material';
import { mensajeDe } from '../shared/api.ts';
import { useSesion } from '../shared/auth.tsx';
import { MARCA } from '../shared/tema.ts';

const campoGrande = { '& .MuiOutlinedInput-root': { height: 48, fontSize: 15 } } as const;

export default function LoginPage() {
  const { login } = useSesion();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const limpiarAvisos = () => { setError(null); setInfo(null); };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    limpiarAvisos();
    if (username.trim() === '' || password === '') {
      setError('Ingresa tu usuario y contraseña.');
      return;
    }
    setOcupado(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(mensajeDe(err));
      setOcupado(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' }, gridTemplateRows: { xs: '200px 1fr', md: 'auto' } }}>
      {/* Panel de marca */}
      <Box sx={{ position: 'relative', overflow: 'hidden', bgcolor: MARCA.azul900, minHeight: { xs: 200, md: '100vh' } }}>
        <Box
          aria-hidden
          sx={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(1200px 500px at 80% -10%, rgba(245,184,61,.18), transparent 60%),
              radial-gradient(900px 500px at -10% 110%, rgba(47,95,196,.35), transparent 55%), ${MARCA.azul900}`,
          }}
        />
        <Box aria-hidden sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(18,48,107,.25) 0%,rgba(18,48,107,.9) 100%)' }} />
        <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, p: { xs: 2.5, md: '48px 56px' }, color: '#fff' }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.25, fontWeight: 700, fontSize: 20, mb: { xs: 1, md: 2.25 } }}>
            <Box
              component="span"
              sx={{ width: 34, height: 34, borderRadius: '9px', bgcolor: MARCA.dorado, color: MARCA.azul900, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}
            >
              B
            </Box>
            Bulksales
          </Box>
          <Typography sx={{ fontSize: { xs: 20, md: 34 }, fontWeight: 600, lineHeight: 1.2, maxWidth: 460 }}>Cada llamada es una oportunidad de venta.</Typography>
          <Typography sx={{ display: { xs: 'none', md: 'block' }, fontSize: 15, color: '#e6ecf8', mt: 1.25, maxWidth: 420 }}>
            Gestiona contactos, ventas y reportes de tu equipo en un solo lugar.
          </Typography>
        </Box>
      </Box>

      {/* Formulario */}
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', p: { xs: '32px 20px', md: '48px 40px' }, bgcolor: 'background.default' }}>
        <Box sx={{ width: '100%', maxWidth: 400 }}>
          <Typography sx={{ fontSize: 34, mb: 3.5, letterSpacing: '.2px' }}>
            <Box component="b" sx={{ fontWeight: 700, color: MARCA.azul700 }}>B</Box>ulksales
          </Typography>

          <Stack component="form" onSubmit={enviar} spacing={2} noValidate>
            <Box>
              <Typography component="h1" sx={{ fontSize: 24, fontWeight: 600 }}>Iniciar sesión</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Ingresa tus credenciales para continuar.</Typography>
            </Box>

            <Box>
              <InputLabel htmlFor="login-usuario" sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', mb: 0.75 }}>Usuario</InputLabel>
              <TextField
                id="login-usuario" fullWidth value={username} placeholder="javier" autoComplete="username" autoFocus sx={campoGrande}
                onChange={(e) => { setUsername(e.target.value); limpiarAvisos(); }} slotProps={{ htmlInput: { maxLength: 50 } }}
              />
            </Box>

            <Box>
              <InputLabel htmlFor="login-clave" sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', mb: 0.75 }}>Contraseña</InputLabel>
              <TextField
                id="login-clave" fullWidth type={mostrar ? 'text' : 'password'} value={password} placeholder="••••••••" autoComplete="current-password" sx={campoGrande}
                onChange={(e) => { setPassword(e.target.value); limpiarAvisos(); }}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <Button size="small" onClick={() => setMostrar((v) => !v)} sx={{ minWidth: 0, fontSize: 13 }}>{mostrar ? 'Ocultar' : 'Mostrar'}</Button>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Box>

            {error && <Alert severity="error">{error}</Alert>}
            {info && <Alert severity="info">{info}</Alert>}

            <Button type="submit" variant="contained" size="large" loading={ocupado} sx={{ height: 48, fontSize: 15 }}>Iniciar sesión</Button>

            <Link
              component="button" type="button" underline="always"
              onClick={() => { setError(null); setInfo('Para reiniciar tu contraseña, contacta al administrador del sistema.'); }}
              sx={{ alignSelf: 'center', fontSize: 14, fontWeight: 500, fontFamily: 'inherit' }}
            >
              ¿Olvidaste o necesitas reiniciar tu contraseña?
            </Link>
          </Stack>

          <Typography sx={{ mt: 4, fontSize: 12.5, lineHeight: 1.7, color: 'text.secondary' }}>
            Este sitio fue desarrollado por @jehh_50<br />Copyright © {new Date().getFullYear()}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
