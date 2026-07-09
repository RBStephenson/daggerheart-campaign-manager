import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium ${
    isActive ? 'bg-slate-900 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
  }`;

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-100">
      <nav aria-label="Main navigation" className="bg-slate-800">
        <div className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-3">
          <span className="mr-4 font-semibold text-white">Daggerheart Campaign Manager</span>
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
          <div className="ml-auto flex items-center gap-3">
            {user ? (
              <>
                <span className="text-sm text-slate-300">
                  {user.username} ({user.role})
                </span>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white"
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
      </nav>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
