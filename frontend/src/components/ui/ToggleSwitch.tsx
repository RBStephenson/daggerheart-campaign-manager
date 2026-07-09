import type { InputHTMLAttributes } from 'react';

type ToggleSwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'>;

/** Accessible switch styled as a track+thumb, backed by a real checkbox. */
export default function ToggleSwitch(props: ToggleSwitchProps) {
  return (
    <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
      <input type="checkbox" className="peer sr-only" {...props} />
      <span
        aria-hidden
        className="absolute inset-0 rounded-full bg-slate-300 transition-colors peer-checked:bg-ember peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ember"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5"
      />
    </span>
  );
}
