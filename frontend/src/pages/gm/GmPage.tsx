import { NavLink, Outlet } from 'react-router-dom';
import { useAppSettings } from '../../context/AppSettingsContext';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `border-b-2 px-1 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'border-ember text-ember-bright'
      : 'border-transparent text-parchment/60 hover:text-parchment'
  }`;

export default function GmPage() {
  const { settings } = useAppSettings();
  return (
    <section
      aria-label="Gamemaster"
      className="relative left-1/2 -mt-6 -mb-6 w-screen -translate-x-1/2 bg-void px-4 py-10"
    >
      <div className="relative mx-auto max-w-5xl">
        <h1 className="mb-1 font-display text-2xl text-parchment">Gamemaster</h1>
        <p className="mb-6 text-sm text-parchment/50">
          Manage your campaigns, your world's Library, and run sessions.
        </p>

        <div className="mb-6 flex flex-wrap gap-4 border-b border-hairline/15">
          <NavLink to="/gm" end className={tabClass}>
            Campaigns
          </NavLink>
          <NavLink to="/gm/library" className={tabClass}>
            Library
          </NavLink>
          {settings.combat_tools_enabled && (
            <NavLink to="/gm/bestiary" className={tabClass}>
              Bestiary
            </NavLink>
          )}
        </div>

        <Outlet />
      </div>
    </section>
  );
}
