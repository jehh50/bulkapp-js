/**
 * Menú principal (mismo orden y agrupación que `nnavbar.php`) y migas del hero.
 */
import { ROLES, ROLES_ADMIN, ROLES_SUPERVISION, type Rol } from '@bulkapp/shared';

export interface Enlace { a: string; texto: string; roles: readonly Rol[] }
export interface Grupo { titulo: string; roles: readonly Rol[]; enlaces: Enlace[][] }
export type EntradaMenu = Enlace | Grupo;

export const esGrupo = (e: EntradaMenu): e is Grupo => 'enlaces' in e;

/** Cada grupo lleva sus enlaces en bloques: entre bloques va un separador. */
export const MENU: EntradaMenu[] = [
  { a: '/dashboard', texto: 'Dashboard', roles: ROLES_SUPERVISION },
  { a: '/', texto: 'Formulario', roles: ROLES },
  {
    titulo: 'Configuración', roles: ROLES_SUPERVISION, enlaces: [
      [{ a: '/admin/productos', texto: 'Listar productos', roles: ROLES_SUPERVISION }],
      [
        { a: '/admin/carga', texto: 'Carga BBDD', roles: ROLES_SUPERVISION },
        { a: '/admin/resultados', texto: 'Editar resultados', roles: ROLES_SUPERVISION },
      ],
      [
        { a: '/admin/usuarios', texto: 'Bandeja de usuarios', roles: ROLES_SUPERVISION },
        { a: '/admin/usuarios/nuevo', texto: 'Nuevo usuario', roles: ROLES_SUPERVISION },
      ],
      [
        { a: '/organizacion', texto: 'Clientes y campañas', roles: ROLES_ADMIN },
        { a: '/constructor', texto: 'Constructor de formularios', roles: ROLES_ADMIN },
      ],
    ],
  },
  {
    titulo: 'Reportes', roles: ROLES_SUPERVISION, enlaces: [
      [{ a: '/reportes/acumulado', texto: 'Acumulado de gestión', roles: ROLES_SUPERVISION }],
      [
        { a: '/reportes/ventas', texto: 'Ventas por estado', roles: ROLES_SUPERVISION },
        { a: '/reportes/detalle-ventas', texto: 'Detalle de ventas', roles: ROLES_SUPERVISION },
        { a: '/reportes/liberar', texto: 'Liberar clientes Banca', roles: ROLES_SUPERVISION },
        { a: '/xml', texto: 'Generar XML', roles: ROLES_SUPERVISION },
      ],
      [{ a: '/reportes/formularios', texto: 'Formularios dinámicos', roles: ROLES_SUPERVISION }],
    ],
  },
];

/** Todos los enlaces del menú, para resolver el más específico. */
const TODOS: Enlace[] = MENU.flatMap((e) => (esGrupo(e) ? e.enlaces.flat() : [e]));

/** Las pantallas de captura cuelgan de «Formulario». */
const esCaptura = (ruta: string): boolean => ruta === '/' || ruta.startsWith('/captura');

export function enlaceActivo(enlace: Enlace, ruta: string): boolean {
  if (enlace.a === '/') return esCaptura(ruta);
  if (ruta === enlace.a) return true;
  // Un prefijo cuenta solo si ningún otro enlace del menú coincide de forma más específica.
  return ruta.startsWith(`${enlace.a}/`) && !TODOS.some((e) => e.a !== enlace.a && e.a.startsWith(`${enlace.a}/`) && (ruta === e.a || ruta.startsWith(`${e.a}/`)));
}

/** Bloques del grupo visibles para el rol (sin bloques vacíos). */
export const bloquesVisibles = (grupo: Grupo, rol: Rol): Enlace[][] =>
  grupo.enlaces.map((b) => b.filter((e) => e.roles.includes(rol))).filter((b) => b.length > 0);

/** Miga del hero: «Grupo / Pantalla» según la ruta actual. */
export function migaDe(ruta: string): string {
  if (ruta.startsWith('/cuenta')) return 'Cuenta / Cambio de contraseña';
  for (const e of MENU) {
    if (!esGrupo(e)) {
      if (enlaceActivo(e, ruta)) return e.texto;
      continue;
    }
    const hallado = e.enlaces.flat().find((x) => enlaceActivo(x, ruta));
    if (hallado) return `${e.titulo} / ${hallado.texto}`;
  }
  return 'Inicio';
}
