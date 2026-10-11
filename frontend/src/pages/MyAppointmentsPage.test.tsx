import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as appointmentsApi from '@/api/appointments';
import * as settingsApi from '@/api/settings';
import { MyAppointmentsPage } from '@/pages/MyAppointmentsPage';
import { renderWithProviders } from '@/test/render';

vi.mock('@/api/client', () => ({
  refreshAccessToken: vi.fn().mockResolvedValue(null),
  tokenStore: { get: () => null, set: vi.fn() },
  apiClient: {},
}));
vi.mock('@/api/appointments');
vi.mock('@/api/settings');

const hours = (h: number) => new Date(Date.now() + h * 60 * 60 * 1000).toISOString();

const base: appointmentsApi.Appointment = {
  id: 'a1',
  startsAt: hours(48),
  endsAt: hours(48.5),
  status: 'CONFIRMED',
  priceAtBooking: 75,
  notes: null,
  service: { id: 's1', name: 'Corte clásico', durationMinutes: 30 },
  staff: { id: 'p1', name: 'Carlos' },
  client: { id: 'u1', name: 'Ana', email: 'ana@test.dev', phone: null },
  cancelledAt: null,
  cancelledBy: null,
  createdAt: hours(-24),
};

describe('Mis citas', () => {
  beforeEach(() => {
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
      demoMode: false,
    });
    vi.mocked(appointmentsApi.fetchMyAppointments).mockImplementation(async (scope) =>
      scope === 'upcoming'
        ? [base, { ...base, id: 'a2', startsAt: hours(3), endsAt: hours(3.5) }]
        : [{ ...base, id: 'a3', status: 'COMPLETED', startsAt: hours(-72), endsAt: hours(-71.5) }],
    );
    vi.mocked(appointmentsApi.cancelAppointment).mockResolvedValue({
      ...base,
      status: 'CANCELLED',
    });
  });

  function renderPage() {
    return renderWithProviders(
      <Routes>
        <Route path="/mis-citas" element={<MyAppointmentsPage />} />
      </Routes>,
      { route: '/mis-citas' },
    );
  }

  it('deshabilita cancelar cuando falta menos de cancellationHours, con explicación', async () => {
    renderPage();
    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(2);

    const [far, soon] = items as [HTMLElement, HTMLElement];
    expect(within(far).getByRole('button', { name: 'Cancelar' })).toBeEnabled();
    expect(within(soon).getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(within(soon).getByText(/12 h de anticipación/)).toBeInTheDocument();
  });

  it('cancela tras confirmar en el diálogo', async () => {
    renderPage();
    const [far] = await screen.findAllByRole('listitem');
    await userEvent.click(within(far!).getByRole('button', { name: 'Cancelar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, cancelar' }));
    await waitFor(() => expect(appointmentsApi.cancelAppointment).toHaveBeenCalledWith('a1'));
  });

  it('la pestaña Historial muestra las citas pasadas', async () => {
    renderPage();
    await screen.findAllByRole('listitem');
    await userEvent.click(screen.getByRole('tab', { name: 'Historial' }));
    expect(await screen.findByText('Completada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
  });
});
