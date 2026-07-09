import { Link } from 'react-router-dom';

const areas = [
  { to: '/host', label: 'Host', image: '/launch/host.webp' },
  { to: '/gm', label: 'Gamemaster', image: '/launch/gm.webp' },
  { to: '/player', label: 'Player', image: '/launch/players.webp' },
] as const;

export default function LaunchPage() {
  return (
    <section
      aria-label="Launch"
      className="relative left-1/2 -mt-6 -mb-6 flex min-h-[80vh] w-screen -translate-x-1/2 flex-col items-center justify-center overflow-hidden bg-void px-4 py-16 text-center sm:py-24"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-ember/10 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 right-1/4 h-96 w-96 rounded-full bg-arcane/15 blur-[120px]"
      />

      <div className="relative mx-auto max-w-5xl">
        <h1 className="font-display text-3xl tracking-[0.3em] text-parchment/90 sm:text-4xl">
          DAGGERHEART
        </h1>
        <p className="mt-2 text-xs tracking-[0.4em] text-parchment/50 uppercase">
          Campaign Manager
        </p>

        <div className="mt-12 flex flex-col items-center justify-center gap-6 sm:gap-4 md:flex-row md:items-end md:gap-8">
          {areas.map(({ to, label, image }) => (
            <Link
              key={to}
              to="/login"
              state={{ from: to }}
              className="group block w-full max-w-56 shrink-0 overflow-hidden rounded-lg shadow-2xl shadow-black/60 ring-1 ring-ember/20 transition-transform duration-300 hover:-translate-y-3 hover:ring-ember/60 focus-visible:-translate-y-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <img
                src={image}
                alt={label}
                className="h-auto w-full transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
