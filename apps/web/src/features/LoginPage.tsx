import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { mensajeDe } from '../shared/api.ts';
import { useSesion } from '../shared/auth.tsx';

export default function LoginPage() {
  const { login } = useSesion();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setOcupado(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(mensajeDe(err));
      setOcupado(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2, background: (t) => `linear-gradient(135deg, ${t.palette.primary.dark}, ${t.palette.primary.main})` }}>
      <Paper component="form" onSubmit={enviar} elevation={8} sx={{ p: 4, width: '100%', maxWidth: 400, borderTop: 5, borderTopColor: 'secondary.main' }}>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700, letterSpacing: 1, color: 'primary.dark' }}>BULKSALES</Typography>
            <Typography variant="body2" color="text.secondary">Ingresa con tu usuario y contraseña.</Typography>
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Usuario" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required size="medium" slotProps={{ htmlInput: { maxLength: 50 } }} />
          <TextField label="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required size="medium" />
          <Button type="submit" variant="contained" size="large" loading={ocupado}>Iniciar sesión</Button>
        </Stack>
      </Paper>
    </Box>
  );
}
