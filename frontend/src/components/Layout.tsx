import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember ${
    isActive
      ? 'bg-ember/20 text-ember-bright'
      : 'text-parchment/60 hover:bg-white/5 hover:text-parchment'
  }`;

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen overflow-x-hidden bg-void">
      <nav aria-label="Main navigation" className="border-b border-hairline/15 bg-nightshade/80">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate font-display text-sm tracking-wide text-parchment sm:text-base">
              Daggerheart Campaign Manager
            </span>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {user ? (
                <>
                  <span className="hidden text-sm text-parchment/50 sm:inline">
                    {user.username} ({user.role})
                  </span>
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="rounded-md px-3 py-2 text-sm font-medium text-parchment/60 transition-colors hover:bg-white/5 hover:text-parchment focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <NavLink to="/login" className={navLinkClass}>
                  Login
                </NavLink>
              )}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {(!user || user.role === 'host') && (
              <NavLink to="/host" className={navLinkClass}>
                Host
              </NavLink>
            )}
            {(!user || user.role === 'gm' || user.role === 'host') && (
              <NavLink to="/gm" className={navLinkClass}>
                Gamemaster
              </NavLink>
            )}
            {(!user || user.role === 'player' || user.role === 'host') && (
              <NavLink to="/player" className={navLinkClass}>
                Player
              </NavLink>
            )}
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
