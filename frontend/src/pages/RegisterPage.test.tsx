import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from '@/api/auth';
import { RegisterPage } from '@/pages/RegisterPage';
import { renderWithProviders } from '@/test/render';

vi.mock('@/api/client', () => ({
  refreshAccessToken: vi.fn().mockResolvedValue(null),
  tokenStore: { get: () => null, set: vi.fn() },
  apiClient: {},
}));
vi.mock('@/api/auth');

function renderRegister() {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<h1>Inicio</h1>} />
      <Route path="/registro" element={<RegisterPage />} />
    </Routes>,
    { route: '/registro' },
  );
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.mocked(authApi.register).mockReset();
  });

  it('valida la contraseña y la confirmación', async () => {
    renderRegister();
    await userEvent.type(screen.getByLabelText('Nombre'), 'Ana');
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'ana@test.dev');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'soloLetras');
    await userEvent.type(screen.getByLabelText('Confirmar contraseña'), 'otra');
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByText('Debe incluir al menos un número')).toBeInTheDocument();
    expect(screen.getByText('Las contraseñas no coinciden')).toBeInTheDocument();
    expect(authApi.register).not.toHaveBeenCalled();
  });

  it('registra y redirige; el teléfono vacío viaja como null', async () => {
    vi.mocked(authApi.register).mockResolvedValue({
      user: {
        id: 'u1',
        name: 'Ana',
        email: 'ana@test.dev',
        phone: null,
        role: 'CLIENT',
        createdAt: '',
      },
      accessToken: 'token',
    });
    renderRegister();
    await userEvent.type(screen.getByLabelText('Nombre'), 'Ana');
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'ana@test.dev');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Secreta123');
    await userEvent.type(screen.getByLabelText('Confirmar contraseña'), 'Secreta123');
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument();
    expect(authApi.register).toHaveBeenCalledWith({
      name: 'Ana',
      email: 'ana@test.dev',
      phone: null,
      password: 'Secreta123',
    });
  });
});
