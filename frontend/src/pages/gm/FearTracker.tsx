import { useEffect, useState } from 'react';
import { adjustFear } from '../../api/campaigns';
import { getGmMoves, type GmMovesData } from '../../api/gmMoves';

const ghostButtonClass =
  'flex h-7 w-7 items-center justify-center rounded-md border border-hairline/20 text-sm text-parchment/70 transition-colors hover:bg-white/5 hover:text-parchment disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember';

/** Reference-only GM-moves popover (DHCM-65/DHCM-93), opened from the Fear
 * tracker since spending Fear is the SRD's own trigger for making a move.
 * Not automated and never forced open on spend -- the GM can ignore it
 * entirely. Fetched when the popover opens, not on every Fear spend (the
 * data is static SRD reference content, so there's no need to tie the
 * fetch to the +/- buttons at all). */
function GmMovesPopover({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<GmMovesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getGmMoves()
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div
      role="dialog"
      aria-label="GM moves reference"
      className="absolute z-10 mt-2 w-80 rounded-[12px] border border-hairline/15 bg-nightshade/95 p-4 text-sm shadow-lg backdrop-blur-sm"
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-sm tracking-wide text-parchment/80">GM moves</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close GM moves reference"
          className="text-parchment/40 hover:text-parchment"
        >
          ×
        </button>
      </div>
      {loading && <p className="text-parchment/50">Loading...</p>}
      {error && <p className="text-danger-text">Couldn't load the GM-moves reference.</p>}
      {data && (
        <>
          <p className="mb-2 text-xs text-parchment/50">{data.soft_vs_hard.guidance}</p>
          <ul className="flex flex-col gap-1">
            {data.moves.map((move) => (
              <li key={move} className="text-parchment/70">
                {move}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

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
  const [showMoves, setShowMoves] = useState(false);

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
    <div className="relative flex items-center gap-2" role="group" aria-label="Fear pool">
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
      <button
        type="button"
        onClick={() => setShowMoves((v) => !v)}
        className={`${ghostButtonClass} w-auto px-2`}
        aria-label="GM moves reference"
      >
        ?
      </button>
      {showMoves && <GmMovesPopover onClose={() => setShowMoves(false)} />}
    </div>
  );
}
