import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAppSettings } from '../../context/AppSettingsContext';

const THEME_STORAGE_KEY = 'dhcm-host-theme';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `border-b-2 px-1 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'border-admin-accent text-admin-accent'
      : 'border-transparent text-admin-subtext hover:text-admin-heading dark:text-admin-subtext-dark dark:hover:text-admin-heading-dark'
  }`;

/** Real, persisted preference for the Host admin theme — does not affect the
 * always-dark fantasy areas (Launch/Login/GM/Player), which never carry the
 * `.dark` class this scoped variant keys off. */
function useHostTheme() {
  const [dark, setDark] = useState(() => localStorage.getItem(THEME_STORAGE_KEY) === 'dark');

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, dark ? 'dark' : 'light');
  }, [dark]);

  return [dark, setDark] as const;
}

export default function HostPage() {
  const location = useLocation();
  const atRoot = location.pathname === '/host';
  const { settings } = useAppSettings();
  const [dark, setDark] = useHostTheme();

  return (
    <section
      aria-label="Host"
      className={`${dark ? 'dark' : ''} -m-4 min-h-[calc(100vh-64px)] bg-admin-bg px-4 py-6 sm:-m-6 sm:px-6 dark:bg-admin-bg-dark`}
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl text-admin-heading dark:text-admin-heading-dark">
              Host{' '}
              <span aria-hidden className="text-sm font-sans font-normal text-admin-accent">
                ADMIN
              </span>
            </h1>
            <p className="mt-1 text-sm text-admin-subtext dark:text-admin-subtext-dark">
              Feature flags and data management for this instance.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDark((d) => !d)}
            className="shrink-0 rounded-md border border-admin-border bg-admin-card px-3 py-2 text-sm font-medium text-admin-heading transition-colors hover:bg-admin-divider focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin-accent dark:border-admin-border-dark dark:bg-admin-card-dark dark:text-admin-heading-dark dark:hover:bg-admin-divider-dark"
          >
            {dark ? 'Light mode' : 'Dark mode'}
          </button>
        </div>

        <div className="mb-6 flex flex-wrap gap-4 border-b border-admin-divider dark:border-admin-divider-dark">
          <NavLink to="/host/settings" className={tabClass}>
            Settings
          </NavLink>
          {settings.data_management_enabled && (
            <NavLink to="/host/data" className={tabClass}>
              Data
            </NavLink>
          )}
        </div>

        {atRoot ? (
          <p className="text-admin-subtext dark:text-admin-subtext-dark">
            Server configuration and feature flags live here.
          </p>
        ) : (
          <Outlet />
        )}
      </div>
    </section>
  );
}
