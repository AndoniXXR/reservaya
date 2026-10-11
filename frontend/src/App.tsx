import { Route, Routes } from 'react-router';
import { AdminLayout } from '@/layouts/AdminLayout';
import { AppLayout } from '@/layouts/AppLayout';
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { ServicesPage } from '@/pages/admin/ServicesPage';
import { SettingsPage } from '@/pages/admin/SettingsPage';
import { StaffDetailPage } from '@/pages/admin/StaffDetailPage';
import { StaffPage } from '@/pages/admin/StaffPage';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { RegisterPage } from '@/pages/RegisterPage';
import { RequireAuth } from '@/routes/RequireAuth';
import { RequireRole } from '@/routes/RequireRole';

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegisterPage />} />

        <Route element={<RequireAuth />}>
          <Route path="/perfil" element={<ProfilePage />} />
          <Route element={<RequireRole role="ADMIN" />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="servicios" element={<ServicesPage />} />
              <Route path="profesionales" element={<StaffPage />} />
              <Route path="profesionales/:id" element={<StaffDetailPage />} />
              <Route path="configuracion" element={<SettingsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
