import { useState, type FormEvent } from 'react';
import { Alert, Button, Stack, TextField } from '@mui/material';
import { PASSWORD_MIN } from '@bulkapp/shared';
import { ApiError, api, mensajeDe } from '../shared/api.ts';
import { useSesion } from '../shared/auth.tsx';
import { Pagina, Seccion, useAvisos } from '../shared/ui.tsx';

export default function PasswordPage() {
  const { logout } = useSesion();
  const avisos = useAvisos();
  const [f, setF] = useState({ actual: '', nueva: '', confirmacion: '' });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setOcupado(true);
    setError(null);
    setErrores({});
    try {
      await api.post('/auth/password', f);
      avisos.ok('Contraseña actualizada. Inicia sesión de nuevo.');
      await logout();
    } catch (err) {
      setError(mensajeDe(err));
      if (err instanceof ApiError) setErrores(err.porCampo);
      setOcupado(false);
    }
  };

  const campo = (k: keyof typeof f, label: string, autoComplete: string) => (
    <TextField
      label={label} type="password" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} autoComplete={autoComplete}
      required error={k in errores} helperText={errores[k]}
    />
  );

  return (
    <Pagina titulo="Cambio de contraseña" subtitulo="Actualiza tu clave de acceso. Al guardar tendrás que iniciar sesión de nuevo.">
      <Seccion sx={{ maxWidth: 460 }}>
        <Stack component="form" onSubmit={enviar} spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          {campo('actual', 'Contraseña actual', 'current-password')}
          {campo('nueva', `Nueva contraseña (mínimo ${PASSWORD_MIN} caracteres)`, 'new-password')}
          {campo('confirmacion', 'Repite la nueva contraseña', 'new-password')}
          <Button type="submit" variant="contained" loading={ocupado} sx={{ alignSelf: 'flex-start' }}>Guardar contraseña</Button>
        </Stack>
      </Seccion>
    </Pagina>
  );
}
