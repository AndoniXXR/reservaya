import { Navigate, Outlet } from 'react-router';
import type { Role } from '@/api/auth';
import { useAuth } from '@/features/auth/useAuth';

// Se usa dentro de <RequireAuth>, así que el usuario ya existe aquí
export function RequireRole({ role }: { role: Role }) {
  const { user } = useAuth();
  if (user?.role !== role) return <Navigate to="/" replace />;
  return <Outlet />;
}
