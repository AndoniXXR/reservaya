import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as servicesApi from '@/api/services';
import * as settingsApi from '@/api/settings';
import * as staffApi from '@/api/staff';
import { clearDraft } from '@/features/booking/draft';
import { BookingPage } from '@/pages/BookingPage';
import { renderWithProviders } from '@/test/render';

vi.mock('@/api/client', () => ({
  refreshAccessToken: vi.fn().mockResolvedValue(null),
  tokenStore: { get: () => null, set: vi.fn() },
  apiClient: {},
}));
vi.mock('@/api/services');
vi.mock('@/api/staff');
vi.mock('@/api/settings');
vi.mock('@/api/availability');
vi.mock('@/api/appointments');

const services: servicesApi.Service[] = [
  {
    id: 's1',
    name: 'Corte clásico',
    description: null,
    durationMinutes: 30,
    price: 75,
    active: true,
  },
  {
    id: 's2',
    name: 'Corte + barba',
    description: null,
    durationMinutes: 45,
    price: 110,
    active: true,
  },
];
const staff: staffApi.Staff[] = [
  { id: 'p1', name: 'Carlos', bio: null, active: true, services: [] },
  { id: 'p2', name: 'Luis', bio: null, active: true, services: [] },
];

describe('asistente de reserva', () => {
  beforeEach(() => {
    clearDraft();
    vi.mocked(servicesApi.fetchServices).mockResolvedValue(services);
    vi.mocked(staffApi.fetchStaff).mockResolvedValue(staff);
    vi.mocked(settingsApi.fetchSettings).mockResolvedValue({
      businessName: 'Demo',
      timezone: 'America/Guatemala',
      slotIntervalMinutes: 15,
      minAdvanceHours: 2,
      maxAdvanceDays: 30,
      cancellationHours: 12,
      contactPhone: null,
      address: null,
      description: null,
    });
  });

  it('avanza por los pasos y conserva la selección al volver atrás', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/reservar" element={<BookingPage />} />
      </Routes>,
      { route: '/reservar' },
    );

    // Paso 1: servicio
    await userEvent.click(await screen.findByRole('button', { name: /Corte \+ barba/ }));
    expect(screen.getByRole('heading', { name: '¿Con quién?' })).toBeInTheDocument();

    // El paso 1 muestra el resumen de lo elegido
    const steps = screen.getByRole('list', { name: 'Pasos' });
    expect(within(steps).getByText('Corte + barba')).toBeInTheDocument();

    // Paso 2: profesional
    await userEvent.click(await screen.findByRole('button', { name: /Luis/ }));
    expect(screen.getByRole('heading', { name: '¿Cuándo?' })).toBeInTheDocument();
    expect(within(steps).getByText('Luis')).toBeInTheDocument();

    // Volver atrás conserva al profesional elegido
    await userEvent.click(screen.getByRole('button', { name: 'Atrás' }));
    expect(await screen.findByRole('button', { name: /Luis/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // Y el servicio sigue seleccionado en el paso 1
    await userEvent.click(within(steps).getByRole('button', { name: /1\. Servicio/ }));
    expect(await screen.findByRole('button', { name: /Corte \+ barba/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /Corte clásico/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('el calendario deshabilita los días pasados', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/reservar" element={<BookingPage />} />
      </Routes>,
      { route: '/reservar' },
    );
    await userEvent.click(await screen.findByRole('button', { name: /Corte clásico/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Cualquiera disponible/ }));

    const grid = await screen.findByRole('grid', { name: 'Calendario' });
    const today = new Date();
    const todayLabel = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    expect(within(grid).getByRole('gridcell', { name: todayLabel })).toBeEnabled();
    if (today.getDate() > 1) {
      const yesterdayLabel = todayLabel.slice(0, 8) + String(today.getDate() - 1).padStart(2, '0');
      expect(within(grid).getByRole('gridcell', { name: yesterdayLabel })).toBeDisabled();
    }
  });
});
