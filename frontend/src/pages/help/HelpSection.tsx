import { useState, type ReactNode } from 'react';

const cardClass =
  'rounded-[12px] border border-hairline/15 bg-nightshade/60 p-5 backdrop-blur-sm';

/** A single collapsible topic in a GM/Player guide. Starts open by default
 * so a first-time reader sees content immediately; collapsing just helps
 * once they know the app and want to jump around. */
export default function HelpSection({
  title,
  flag,
  defaultOpen = true,
  children,
}: {
  title: string;
  flag?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <li className={cardClass}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div className="min-w-0">
          <h3 className="break-words font-display text-sm text-parchment">{title}</h3>
          {flag && (
            <p className="text-xs text-parchment/40">
              Requires the <code className="text-parchment/60">{flag}</code> setting (Host →
              Settings)
            </p>
          )}
        </div>
        <span className="shrink-0 text-xs text-parchment/40">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-2 border-t border-hairline/15 pt-3 text-sm text-parchment/80">
          {children}
        </div>
      )}
    </li>
  );
}
