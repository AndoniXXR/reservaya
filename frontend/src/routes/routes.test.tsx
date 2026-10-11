import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { User } from '@/api/auth';
import type { AuthContextValue } from '@/features/auth/context';
import { useAuth } from '@/features/auth/useAuth';
import { RequireAuth } from '@/routes/RequireAuth';
import { RequireRole } from '@/routes/RequireRole';

vi.mock('@/features/auth/useAuth');

const client: User = {
  id: 'u1',
  name: 'Ana',
  email: 'ana@test.dev',
  phone: null,
  role: 'CLIENT',
  createdAt: '',
};

function mockAuth(user: User | null, loading = false) {
  vi.mocked(useAuth).mockReturnValue({ user, loading } as AuthContextValue);
}

function renderAt(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/" element={<h1>Inicio</h1>} />
        <Route path="/login" element={<h1>Login</h1>} />
        <Route element={<RequireAuth />}>
          <Route path="/perfil" element={<h1>Perfil</h1>} />
          <Route element={<RequireRole role="ADMIN" />}>
            <Route path="/admin" element={<h1>Admin</h1>} />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('rutas protegidas', () => {
  it('redirige a /login sin sesión', () => {
    mockAuth(null);
    renderAt('/perfil');
    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument();
  });

  it('muestra un indicador mientras se recupera la sesión', () => {
    mockAuth(null, true);
    renderAt('/perfil');
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Login' })).not.toBeInTheDocument();
  });

  it('deja pasar a un usuario autenticado', () => {
    mockAuth(client);
    renderAt('/perfil');
    expect(screen.getByRole('heading', { name: 'Perfil' })).toBeInTheDocument();
  });

  it('redirige a / cuando el rol no corresponde', () => {
    mockAuth(client);
    renderAt('/admin');
    expect(screen.getByRole('heading', { name: 'Inicio' })).toBeInTheDocument();
  });

  it('deja pasar al admin', () => {
    mockAuth({ ...client, role: 'ADMIN' });
    renderAt('/admin');
    expect(screen.getByRole('heading', { name: 'Admin' })).toBeInTheDocument();
  });
});
