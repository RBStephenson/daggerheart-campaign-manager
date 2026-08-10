import { useEffect, useState, type FormEvent } from 'react';
import Skeleton from '../../components/ui/Skeleton';
import { ApiError } from '../../api/client';
import {
  advanceCountdown,
  createCountdown,
  deleteCountdown,
  listCountdowns,
  type Countdown,
} from '../../api/campaigns';

const cardClass =
  'rounded-[12px] border border-hairline/15 bg-nightshade/60 p-5 backdrop-blur-sm';
const inputClass =
  'w-full rounded-md border border-hairline/20 bg-input-dark px-3 py-2 text-sm text-parchment placeholder:text-parchment/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember';
const ghostButtonClass =
  'rounded-md border border-hairline/20 px-3 py-2 text-sm text-parchment/70 transition-colors hover:bg-white/5 hover:text-parchment focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember';

export default function CountdownsPanel({ campaignId }: { campaignId: number }) {
  const [countdowns, setCountdowns] = useState<Countdown[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setCountdowns(await listCountdowns(campaignId));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const name = String(form.get('name') ?? '').trim();
    const startingValue = Number(form.get('starting_value'));
    const loop = form.get('loop') === 'on';
    if (!name || !Number.isInteger(startingValue) || startingValue < 1) return;
    try {
      await createCountdown(campaignId, name, startingValue, loop);
      formEl.reset();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create countdown.');
    }
  }

  async function handleAdvance(countdownId: number, delta: number) {
    const updated = await advanceCountdown(campaignId, countdownId, delta);
    setCountdowns((prev) => prev?.map((c) => (c.id === countdownId ? updated : c)) ?? prev);
  }

  async function handleDelete(countdownId: number) {
    await deleteCountdown(campaignId, countdownId);
    await refresh();
  }

  return (
    <div>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-danger/50 bg-danger-bg/10 px-4 py-3 text-sm text-danger-text"
        >
          {error}
        </div>
      )}

      <form onSubmit={(e) => void handleCreate(e)} className={`mb-6 flex max-w-md flex-col gap-2 ${cardClass}`}>
        <h3 className="mb-1 font-display text-sm tracking-wide text-parchment/80">New Countdown</h3>
        <input name="name" placeholder="Countdown name" required className={inputClass} />
        <input
          name="starting_value"
          type="number"
          min={1}
          placeholder="Starting value"
          required
          className={inputClass}
        />
        <label className="flex items-center gap-2 text-sm text-parchment/70">
          <input name="loop" type="checkbox" className="h-4 w-4" />
          Loop (resets to starting value when triggered)
        </label>
        <button
          type="submit"
          className="self-start rounded-md bg-ember px-4 py-2 text-sm font-semibold text-void transition-colors hover:bg-ember-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-bright"
        >
          Create countdown
        </button>
      </form>

      {loading ? (
        <ul className="flex flex-col gap-2" aria-label="Loading countdowns">
          {[0, 1].map((i) => (
            <li key={i} className={cardClass}>
              <Skeleton className="h-5 w-1/3" />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-2">
          {countdowns?.map((countdown) => (
            <li
              key={countdown.id}
              className="flex items-center justify-between gap-4 rounded-md border border-hairline/15 bg-nightshade/60 px-4 py-2"
            >
              <div className="min-w-0">
                <span className="break-words text-sm text-parchment">{countdown.name}</span>
                {countdown.loop && <span className="ml-2 text-xs text-parchment/50">(loop)</span>}
                {countdown.triggered_at && (
                  <span className="ml-2 text-xs text-ember">Triggered!</span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleAdvance(countdown.id, 1)}
                  disabled={countdown.current_value <= 0 && !countdown.loop}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-hairline/20 text-sm text-parchment/70 transition-colors hover:bg-white/5 hover:text-parchment disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember"
                  aria-label={`Advance ${countdown.name}`}
                >
                  −
                </button>
                <span className="w-16 text-center font-display text-sm text-parchment">
                  {countdown.current_value} / {countdown.starting_value}
                </span>
                <button type="button" onClick={() => void handleDelete(countdown.id)} className={ghostButtonClass}>
                  Delete
                </button>
              </div>
            </li>
          ))}
          {countdowns?.length === 0 && (
            <li className="rounded-[12px] border border-dashed border-hairline/25 p-6 text-center text-sm text-parchment/50">
              No countdowns yet. Create one above.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
