import type { Location } from 'react-router';

/**
 * Ruta a la que volver tras iniciar sesión. Viaja en la query (?next=/mis-citas) en lugar
 * de en el state del router para que sobreviva a una recarga completa de la página.
 */
export function loginPath(location: Pick<Location, 'pathname' | 'search'>, page = '/login') {
  const next = `${location.pathname}${location.search}`;
  return `${page}?next=${encodeURIComponent(next)}`;
}

/** Solo rutas internas: evita redirecciones abiertas a otros dominios. */
export function readReturnTo(search: string): string {
  const next = new URLSearchParams(search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}
