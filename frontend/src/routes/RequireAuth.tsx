import { Navigate, Outlet, useLocation } from 'react-router';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { useAuth } from '@/features/auth/useAuth';
import { loginPath } from '@/lib/returnTo';

export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to={loginPath(location)} replace />;
  return <Outlet />;
}
