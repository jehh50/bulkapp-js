/**
 * Render de un campo de formulario dinámico (captura del operador y vista previa
 * del Constructor).
 */
import { Grid, TextField } from '@mui/material';
import {
  TRANSFORMACION, condicionCumplida, hijosDeNodo, mascaraTelefonoFormulario, type CampoDef, type Definicion, type ValorCampo, type Valores,
} from '@bulkapp/shared';
import { Selector } from '../shared/ui.tsx';

const NIVELES_VACIOS = { lv1: '', lv2: '' };

function transformar(c: CampoDef, valor: string): string {
  if (c.transform === TRANSFORMACION.MAYUSCULAS) return valor.toUpperCase();
  if (c.transform === TRANSFORMACION.TELEFONO) return mascaraTelefonoFormulario(valor);
  return valor;
}

/** Campos visibles según sus condiciones (misma regla que la validación). */
export function camposVisibles(definicion: Definicion, valores: Valores): CampoDef[] {
  const visibles: Valores = {};
  return definicion.campos.filter((c) => {
    if (c.cond && !condicionCumplida(c.cond, visibles)) return false;
    const v = valores[c.k];
    if (v !== undefined) visibles[c.k] = v;
    return true;
  });
}

export function CampoDinamico({ campo: c, valor, error, onChange, soloLectura }: {
  campo: CampoDef; valor: ValorCampo | undefined; error?: string | undefined; onChange: (valor: ValorCampo) => void; soloLectura?: boolean;
}) {
  const comunes = { fullWidth: true, required: c.req === true, error: error !== undefined, helperText: error ?? c.help, disabled: soloLectura } as const;

  if (c.type === 'nested') {
    const v = typeof valor === 'object' ? valor : NIVELES_VACIOS;
    const nodo = (c.tree ?? []).find((n) => n.p === v.lv1);
    return (
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Selector
            {...comunes} label={c.lv1 ?? c.label} value={v.lv1} vacio="Selecciona…"
            opciones={(c.tree ?? []).map((n) => ({ value: n.p, label: n.p }))}
            onChange={(e) => onChange({ lv1: e.target.value, lv2: '' })}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Selector
            {...comunes} helperText={undefined} label={c.lv2 ?? 'Detalle'} value={v.lv2} vacio="Selecciona…" disabled={soloLectura || !nodo}
            opciones={(nodo ? hijosDeNodo(nodo) : []).map((h) => ({ value: h, label: h }))}
            onChange={(e) => onChange({ lv1: v.lv1, lv2: e.target.value })}
          />
        </Grid>
      </Grid>
    );
  }

  const texto = typeof valor === 'string' ? valor : '';
  if (c.type === 'select') {
    return (
      <Selector
        {...comunes} label={c.label} value={texto} vacio="Selecciona…" opciones={(c.opts ?? []).map((o) => ({ value: o, label: o }))}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  const esTexto = c.type === 'text' || c.type === 'textarea';
  return (
    <TextField
      {...comunes} label={c.label} value={texto} placeholder={c.placeholder}
      type={c.type === 'textarea' || c.type === 'text' ? 'text' : c.type}
      multiline={c.type === 'textarea'} minRows={c.type === 'textarea' ? 3 : undefined}
      onChange={(e) => onChange(transformar(c, e.target.value))}
      slotProps={{
        inputLabel: c.type === 'date' ? { shrink: true } : {},
        htmlInput: {
          ...(esTexto && c.max !== undefined ? { maxLength: c.max } : {}),
          ...(c.type === 'number' ? { min: c.min, max: c.max, step: 'any' } : {}),
        },
      }}
    />
  );
}
