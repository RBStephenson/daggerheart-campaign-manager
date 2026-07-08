import { NavLink, Outlet } from 'react-router-dom';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium ${
    isActive ? 'bg-slate-900 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
  }`;

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-100">
      <nav aria-label="Main navigation" className="bg-slate-800">
        <div className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-3">
          <span className="mr-4 font-semibold text-white">Daggerheart Campaign Manager</span>
          <NavLink to="/host" className={navLinkClass}>
            Host
          </NavLink>
          <NavLink to="/gm" className={navLinkClass}>
            Gamemaster
          </NavLink>
          <NavLink to="/player" className={navLinkClass}>
            Player
          </NavLink>
          <NavLink to="/login" className={navLinkClass}>
            Login
          </NavLink>
        </div>
      </nav>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
