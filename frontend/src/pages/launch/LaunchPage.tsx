import { Link } from 'react-router-dom';

const areas = [
  { to: '/host', label: 'Host' },
  { to: '/gm', label: 'GM Dashboard' },
  { to: '/player', label: 'Player Dashboard' },
] as const;

export default function LaunchPage() {
  return (
    <section aria-label="Launch" className="mx-auto max-w-md text-center">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Daggerheart Campaign Manager</h1>
      <div className="flex flex-col gap-3">
        {areas.map(({ to, label }) => (
          <Link
            key={to}
            to="/login"
            state={{ from: to }}
            className="rounded-md bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-700"
          >
            {label}
          </Link>
        ))}
      </div>
    </section>
  );
}
