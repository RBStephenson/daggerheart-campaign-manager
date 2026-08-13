import { useEffect, useMemo, useState } from 'react';
import { getBestiary, type Adversary } from '../../api/bestiary';
import {
  COST_BY_TYPE,
  getEncounterBudget,
  type EncounterBudgetAdjustments,
} from '../../api/campaigns';
import { ApiError } from '../../api/client';

const cardClass =
  'rounded-[12px] border border-hairline/15 bg-nightshade/60 p-5 backdrop-blur-sm';
const inputClass =
  'w-full rounded-md border border-hairline/20 bg-input-dark px-3 py-2 text-sm text-parchment placeholder:text-parchment/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember';
const ghostButtonClass =
  'rounded-md border border-hairline/20 px-3 py-2 text-sm text-parchment/70 transition-colors hover:bg-white/5 hover:text-parchment focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember';

const ADJUSTMENT_LABELS: Record<keyof EncounterBudgetAdjustments, string> = {
  easier_fight: 'Easier or shorter fight (-1)',
  two_plus_solos: '2+ Solo adversaries (-2)',
  bonus_damage: 'Bonus damage to all adversaries (-2)',
  lower_tier_adversary: 'Includes a lower-tier adversary (+1)',
  no_bruiser_horde_leader_solo: 'No Bruisers/Hordes/Leaders/Solos (+1)',
  harder_fight: 'Harder or longer fight (+2)',
};

const DEFAULT_ADJUSTMENTS: EncounterBudgetAdjustments = {
  easier_fight: false,
  two_plus_solos: false,
  bonus_damage: false,
  lower_tier_adversary: false,
  no_bruiser_horde_leader_solo: false,
  harder_fight: false,
};

interface PickedAdversary {
  key: string;
  name: string;
  type: string;
}

export default function EncounterBuilderPanel({ campaignId }: { campaignId: number }) {
  const [adjustments, setAdjustments] = useState<EncounterBudgetAdjustments>(
    DEFAULT_ADJUSTMENTS,
  );
  const [partySize, setPartySize] = useState<number | null>(null);
  const [budget, setBudget] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adversaries, setAdversaries] = useState<Adversary[]>([]);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<PickedAdversary[]>([]);

  useEffect(() => {
    getBestiary()
      .then((dataset) => setAdversaries(dataset.adversaries))
      .catch(() => {
        // Bestiary might be unavailable independently — the picker is an
        // optional enhancement, the budget itself still works without it.
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getEncounterBudget(campaignId, adjustments)
      .then((result) => {
        if (cancelled) return;
        setPartySize(result.party_size);
        setBudget(result.budget);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Failed to load the encounter budget.');
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, adjustments]);

  function toggleAdjustment(key: keyof EncounterBudgetAdjustments) {
    setAdjustments((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleAdd(adversary: Adversary) {
    setPicked((prev) => [
      ...prev,
      { key: `${adversary.name}-${prev.length}`, name: adversary.name, type: adversary.type },
    ]);
  }

  function handleRemove(key: string) {
    setPicked((prev) => prev.filter((p) => p.key !== key));
  }

  const spent = useMemo(
    () => picked.reduce((sum, p) => sum + (COST_BY_TYPE[p.type] ?? 0), 0),
    [picked],
  );
  const overBudget = budget !== null && spent > budget;

  const filteredAdversaries = useMemo(() => {
    if (!query) return [];
    return adversaries
      .filter((a) => a.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 8);
  }, [adversaries, query]);

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

      <div className={`mb-4 ${cardClass}`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-sm tracking-wide text-parchment/80">
            Battle Points budget
          </h3>
          <span className="text-sm text-parchment">
            Party of {partySize ?? '…'} — budget {budget ?? '…'}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(Object.keys(ADJUSTMENT_LABELS) as (keyof EncounterBudgetAdjustments)[]).map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm text-parchment/70">
              <input
                type="checkbox"
                checked={adjustments[key]}
                onChange={() => toggleAdjustment(key)}
                className="h-4 w-4"
              />
              {ADJUSTMENT_LABELS[key]}
            </label>
          ))}
        </div>
      </div>

      <div className={cardClass}>
        <h3 className="mb-2 font-display text-sm tracking-wide text-parchment/80">
          Add adversaries
        </h3>
        <input
          placeholder="Search adversaries by name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={inputClass}
        />
        {filteredAdversaries.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1">
            {filteredAdversaries.map((a) => (
              <li
                key={a.name}
                className="flex items-center justify-between gap-2 rounded-md border border-hairline/15 px-3 py-1.5 text-sm"
              >
                <span className="text-parchment">
                  {a.name} <span className="text-parchment/50">({a.type}, Tier {a.tier})</span>
                </span>
                <button type="button" onClick={() => handleAdd(a)} className={ghostButtonClass}>
                  Add
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex items-center justify-between">
          <h4 className="text-sm text-parchment/80">Encounter</h4>
          <span
            className={`text-sm font-semibold ${overBudget ? 'text-danger-text' : 'text-parchment'}`}
          >
            {spent} / {budget ?? '…'}
            {overBudget && ' — over budget'}
          </span>
        </div>
        <ul className="mt-2 flex flex-col gap-1">
          {picked.map((p) => (
            <li
              key={p.key}
              className="flex items-center justify-between gap-2 rounded-md border border-hairline/15 px-3 py-1.5 text-sm"
            >
              <span className="text-parchment">
                {p.name} <span className="text-parchment/50">({p.type})</span>
              </span>
              <button type="button" onClick={() => handleRemove(p.key)} className={ghostButtonClass}>
                Remove
              </button>
            </li>
          ))}
          {picked.length === 0 && (
            <li className="rounded-md border border-dashed border-hairline/25 p-4 text-center text-sm text-parchment/50">
              No adversaries added yet.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
