import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-3xl font-bold text-slate-900">Página no encontrada</h1>
      <p className="text-slate-600">La dirección que buscas no existe.</p>
      <Link to="/" className="font-medium text-brand-600 hover:underline">
        Volver al inicio
      </Link>
    </div>
  );
}
