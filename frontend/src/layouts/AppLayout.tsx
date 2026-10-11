import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { useToast } from '@/components/toast/useToast';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/useAuth';
import { useSettings } from '@/hooks/useSettings';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-100'
  }`;

export function AppLayout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const settings = useSettings();

  const handleLogout = async () => {
    // Salir primero de la ruta protegida para que no redirija a /login al vaciar la sesión
    navigate('/');
    await logout();
    toast('Sesión cerrada', 'info');
  };

  return (
    <div className="flex min-h-screen flex-col">
      {settings.data?.demoMode && (
        <p className="bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-800">
          Demo pública: los datos se reinician cada noche y no debes usar datos reales. Los correos
          son visibles para cualquiera en{' '}
          <a href="/mailpit/" className="font-medium underline" target="_blank" rel="noreferrer">
            /mailpit
          </a>
          .
        </p>
      )}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Link to="/" className="text-xl font-bold tracking-tight text-brand-700">
            ReservaYa
          </Link>
          <nav aria-label="Principal" className="flex flex-wrap items-center gap-1">
            <NavLink to="/reservar" className={linkClass}>
              Reservar
            </NavLink>
            {user && (
              <>
                <NavLink to="/mis-citas" className={linkClass}>
                  Mis citas
                </NavLink>
                <NavLink to="/perfil" className={linkClass}>
                  Perfil
                </NavLink>
                {user.role === 'ADMIN' && (
                  <NavLink to="/admin" className={linkClass}>
                    Admin
                  </NavLink>
                )}
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  Salir
                </Button>
              </>
            )}
            {!user && !loading && (
              <NavLink to="/login" className={linkClass}>
                Entrar
              </NavLink>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        ReservaYa · Sistema de gestión de citas
      </footer>
    </div>
  );
}
