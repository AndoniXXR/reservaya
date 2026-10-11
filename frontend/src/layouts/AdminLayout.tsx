import { NavLink, Outlet } from 'react-router';

const links = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/agenda', label: 'Agenda' },
  { to: '/admin/citas', label: 'Citas' },
  { to: '/admin/servicios', label: 'Servicios' },
  { to: '/admin/profesionales', label: 'Profesionales' },
  { to: '/admin/configuracion', label: 'Configuración' },
];

export function AdminLayout() {
  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <nav
        aria-label="Administración"
        className="-mx-4 flex gap-1 overflow-x-auto border-b border-slate-200 px-4 pb-2 md:mx-0 md:w-48 md:shrink-0 md:flex-col md:border-r md:border-b-0 md:pr-4 md:pb-0"
      >
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition ${
                isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-100'
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
