import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from '@/api/auth';
import { LoginPage } from '@/pages/LoginPage';
import { renderWithProviders } from '@/test/render';

vi.mock('@/api/client', () => ({
  refreshAccessToken: vi.fn().mockResolvedValue(null),
  tokenStore: { get: () => null, set: vi.fn() },
  apiClient: {},
}));
vi.mock('@/api/auth');

const user = () => ({
  id: 'u1',
  name: 'Ana',
  email: 'ana@test.dev',
  phone: null,
  role: 'CLIENT' as const,
  createdAt: new Date().toISOString(),
});

function renderLogin(route = '/login') {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<h1>Inicio</h1>} />
      <Route path="/mis-citas" element={<h1>Mis citas</h1>} />
      <Route path="/login" element={<LoginPage />} />
    </Routes>,
    { route },
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.mocked(authApi.login).mockReset();
  });

  it('muestra errores de validación sin llamar a la API', async () => {
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Correo inválido')).toBeInTheDocument();
    expect(screen.getByText('La contraseña es obligatoria')).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('inicia sesión y redirige al inicio', async () => {
    vi.mocked(authApi.login).mockResolvedValue({ user: user(), accessToken: 'token' });
    renderLogin();

    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'ana@test.dev');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Secreta123');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument();
    expect(authApi.login).toHaveBeenCalledWith({ email: 'ana@test.dev', password: 'Secreta123' });
  });

  it('muestra el mensaje del servidor cuando las credenciales son inválidas', async () => {
    const headers = new AxiosHeaders();
    vi.mocked(authApi.login).mockRejectedValue(
      new AxiosError('Unauthorized', '401', { headers }, null, {
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        config: { headers },
        data: { error: { code: 'UNAUTHORIZED', message: 'Correo o contraseña incorrectos' } },
      }),
    );
    renderLogin();

    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'ana@test.dev');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Incorrecta1');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos'),
    );
  });
});
