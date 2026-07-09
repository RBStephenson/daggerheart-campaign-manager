import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAppSettings } from '../../context/AppSettingsContext';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium ${
    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'
  }`;

export default function HostPage() {
  const location = useLocation();
  const atRoot = location.pathname === '/host';
  const { settings } = useAppSettings();

  return (
    <section aria-label="Host">
      <h1 className="mb-4 text-2xl font-bold text-slate-900">Host</h1>
      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <NavLink to="/host/settings" className={tabClass}>
          Settings
        </NavLink>
        {settings.data_management_enabled && (
          <NavLink to="/host/data" className={tabClass}>
            Data Management
          </NavLink>
        )}
      </div>
      {atRoot ? (
        <p className="text-slate-600">Server configuration and feature flags live here.</p>
      ) : (
        <Outlet />
      )}
    </section>
  );
}
