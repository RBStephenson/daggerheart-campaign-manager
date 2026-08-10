import { useState } from 'react';
import { adjustFear } from '../../api/campaigns';

const ghostButtonClass =
  'flex h-7 w-7 items-center justify-center rounded-md border border-hairline/20 text-sm text-parchment/70 transition-colors hover:bg-white/5 hover:text-parchment disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember';

/** The GM's shared Fear pool (0-12, persists across sessions per the SRD). */
export default function FearTracker({
  campaignId,
  fear,
  onChange,
}: {
  campaignId: number;
  fear: number;
  onChange: (fear: number) => void;
}) {
  const [pending, setPending] = useState(false);

  async function adjust(delta: number) {
    setPending(true);
    try {
      const result = await adjustFear(campaignId, delta);
      onChange(result.fear);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Fear pool">
      <span className="text-sm text-parchment/60">Fear</span>
      <button
        type="button"
        onClick={() => void adjust(-1)}
        disabled={pending || fear <= 0}
        className={ghostButtonClass}
        aria-label="Spend a Fear"
      >
        −
      </button>
      <span className="w-6 text-center font-display text-sm text-parchment">{fear}</span>
      <button
        type="button"
        onClick={() => void adjust(1)}
        disabled={pending || fear >= 12}
        className={ghostButtonClass}
        aria-label="Gain a Fear"
      >
        +
      </button>
    </div>
  );
}
