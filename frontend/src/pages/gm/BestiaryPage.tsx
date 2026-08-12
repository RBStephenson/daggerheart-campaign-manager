import { useEffect, useMemo, useState } from 'react';
import Skeleton from '../../components/ui/Skeleton';
import { ApiError } from '../../api/client';
import { getBestiary, type Adversary, type BestiaryDataset, type Environment, type StatBlockFeature } from '../../api/bestiary';
import { createEntity, listWorlds, type World } from '../../api/library';

const cardClass =
  'rounded-[12px] border border-hairline/15 bg-nightshade/60 p-5 backdrop-blur-sm';
const inputClass =
  'w-full rounded-md border border-hairline/20 bg-input-dark px-3 py-2 text-sm text-parchment placeholder:text-parchment/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember';
const tabClass = (active: boolean) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    active ? 'bg-ember/20 text-ember-bright' : 'text-parchment/60 hover:bg-white/5 hover:text-parchment'
  }`;

function FeatureList({ features }: { features: StatBlockFeature[] }) {
  return (
    <ul className="mt-3 flex flex-col gap-2">
      {features.map((f, i) => (
        <li key={i} className="text-sm">
          <span className="font-semibold text-parchment">
            {f.name}
            {f.tag ? ` (${f.tag})` : ''}
          </span>
          <span className="text-parchment/50"> - {f.kind[0].toUpperCase() + f.kind.slice(1)}: </span>
          <span className="text-parchment/80">{f.text}</span>
          {f.questions && <p className="mt-1 text-xs italic text-parchment/50">{f.questions}</p>}
        </li>
      ))}
    </ul>
  );
}

function AdversaryCard({
  adversary,
  world,
  onSpawn,
}: {
  adversary: Adversary;
  world: World | null;
  onSpawn: (adversary: Adversary) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [spawning, setSpawning] = useState(false);
  const [spawned, setSpawned] = useState(false);

  async function handleSpawn() {
    setSpawning(true);
    try {
      await onSpawn(adversary);
      setSpawned(true);
    } finally {
      setSpawning(false);
    }
  }

  return (
    <li className={cardClass}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div className="min-w-0">
          <h3 className="break-words font-display text-sm text-parchment">{adversary.name}</h3>
          <p className="text-xs text-parchment/50">
            Tier {adversary.tier} {adversary.type}
            {adversary.horde_hp_per_rank ? ` (${adversary.horde_hp_per_rank}/HP)` : ''}
          </p>
        </div>
        <span className="shrink-0 text-xs text-parchment/40">{open ? 'Hide' : 'Details'}</span>
      </button>

      {open && (
        <div className="mt-3 border-t border-hairline/15 pt-3">
          <p className="text-sm text-parchment/70">{adversary.description}</p>
          <p className="mt-2 text-xs text-parchment/50">
            Motives &amp; Tactics: {adversary.motives_and_tactics}
          </p>
          <p className="mt-2 text-xs text-parchment/70">
            Difficulty: {adversary.difficulty} | Thresholds:{' '}
            {adversary.threshold_major ?? 'None'}/{adversary.threshold_severe ?? 'None'} | HP:{' '}
            {adversary.hp} | Stress: {adversary.stress}
          </p>
          <p className="mt-1 text-xs text-parchment/70">
            ATK: {adversary.attack_modifier} | {adversary.standard_attack_name}:{' '}
            {adversary.standard_attack_range} | {adversary.standard_attack_damage}
          </p>
          {adversary.experience && (
            <p className="mt-1 text-xs text-parchment/70">Experience: {adversary.experience}</p>
          )}
          <FeatureList features={adversary.features} />

          <div className="mt-4">
            {world ? (
              <button
                type="button"
                onClick={() => void handleSpawn()}
                disabled={spawning || spawned}
                className="rounded-md bg-ember px-3 py-2 text-sm font-semibold text-void transition-colors hover:bg-ember-bright disabled:cursor-not-allowed disabled:opacity-50"
              >
                {spawned ? 'Added to Library' : spawning ? 'Adding…' : 'Add to Library'}
              </button>
            ) : (
              <p className="text-xs text-parchment/50">
                Create a Library world first (Library tab) to add adversaries to it.
              </p>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function EnvironmentCard({
  environment,
  world,
  onSpawn,
}: {
  environment: Environment;
  world: World | null;
  onSpawn: (environment: Environment) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [spawning, setSpawning] = useState(false);
  const [spawned, setSpawned] = useState(false);

  async function handleSpawn() {
    setSpawning(true);
    try {
      await onSpawn(environment);
      setSpawned(true);
    } finally {
      setSpawning(false);
    }
  }

  return (
    <li className={cardClass}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div className="min-w-0">
          <h3 className="break-words font-display text-sm text-parchment">{environment.name}</h3>
          <p className="text-xs text-parchment/50">
            Tier {environment.tier} {environment.type}
          </p>
        </div>
        <span className="shrink-0 text-xs text-parchment/40">{open ? 'Hide' : 'Details'}</span>
      </button>

      {open && (
        <div className="mt-3 border-t border-hairline/15 pt-3">
          <p className="text-sm text-parchment/70">{environment.description}</p>
          <p className="mt-2 text-xs text-parchment/50">Impulses: {environment.impulses}</p>
          {environment.difficulty !== null && (
            <p className="mt-1 text-xs text-parchment/70">Difficulty: {environment.difficulty}</p>
          )}
          {environment.potential_adversaries && (
            <p className="mt-1 text-xs text-parchment/70">
              Potential Adversaries: {environment.potential_adversaries}
            </p>
          )}
          <FeatureList features={environment.features} />

          <div className="mt-4">
            {world ? (
              <button
                type="button"
                onClick={() => void handleSpawn()}
                disabled={spawning || spawned}
                className="rounded-md bg-ember px-3 py-2 text-sm font-semibold text-void transition-colors hover:bg-ember-bright disabled:cursor-not-allowed disabled:opacity-50"
              >
                {spawned ? 'Added to Library' : spawning ? 'Adding…' : 'Add to Library'}
              </button>
            ) : (
              <p className="text-xs text-parchment/50">
                Create a Library world first (Library tab) to add environments to it.
              </p>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

const TIER_OPTIONS = [0, 1, 2, 3, 4] as const;

export default function BestiaryPage() {
  const [dataset, setDataset] = useState<BestiaryDataset | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [world, setWorld] = useState<World | null>(null);
  const [activeTab, setActiveTab] = useState<'adversaries' | 'environments'>('adversaries');
  const [query, setQuery] = useState('');
  const [tier, setTier] = useState<(typeof TIER_OPTIONS)[number]>(0);

  useEffect(() => {
    getBestiary()
      .then(setDataset)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) {
          setDisabled(true);
        } else {
          console.error(err);
        }
      });
    listWorlds()
      .then((worlds) => setWorld(worlds[0] ?? null))
      .catch(() => {
        // Library might be disabled independently of combat tools — spawning
        // is an optional enhancement, not a hard requirement for browsing.
      });
  }, []);

  async function handleSpawn(adversary: Adversary) {
    if (!world) return;
    await createEntity('adversaries', world.id, {
      name: adversary.name,
      summary: adversary.description,
      extra: JSON.stringify(adversary),
    });
  }

  async function handleSpawnEnvironment(environment: Environment) {
    if (!world) return;
    await createEntity('environments', world.id, {
      name: environment.name,
      summary: environment.description,
      extra: JSON.stringify(environment),
    });
  }

  const filteredAdversaries = useMemo(() => {
    if (!dataset) return [];
    return dataset.adversaries.filter(
      (a) =>
        a.name.toLowerCase().includes(query.toLowerCase()) && (tier === 0 || a.tier === tier),
    );
  }, [dataset, query, tier]);

  const filteredEnvironments = useMemo(() => {
    if (!dataset) return [];
    return dataset.environments.filter(
      (e) =>
        e.name.toLowerCase().includes(query.toLowerCase()) && (tier === 0 || e.tier === tier),
    );
  }, [dataset, query, tier]);

  if (disabled) {
    return <p className="text-parchment/60">The bestiary feature is currently disabled.</p>;
  }

  if (!dataset) {
    return (
      <div className={cardClass}>
        <Skeleton className="mb-2 h-5 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1">
        <button type="button" onClick={() => setActiveTab('adversaries')} className={tabClass(activeTab === 'adversaries')}>
          Adversaries ({dataset.adversaries.length})
        </button>
        <button type="button" onClick={() => setActiveTab('environments')} className={tabClass(activeTab === 'environments')}>
          Environments ({dataset.environments.length})
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name"
          className={`max-w-xs ${inputClass}`}
        />
        <select
          value={tier}
          onChange={(e) => setTier(Number(e.target.value) as (typeof TIER_OPTIONS)[number])}
          aria-label="Filter by tier"
          className={`w-auto ${inputClass}`}
        >
          {TIER_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t === 0 ? 'All tiers' : `Tier ${t}`}
            </option>
          ))}
        </select>
      </div>

      {activeTab === 'adversaries' ? (
        <ul className="flex flex-col gap-2">
          {filteredAdversaries.map((a) => (
            <AdversaryCard key={a.name} adversary={a} world={world} onSpawn={handleSpawn} />
          ))}
          {filteredAdversaries.length === 0 && (
            <li className={`${cardClass} text-center text-sm text-parchment/50`}>
              No adversaries match.
            </li>
          )}
        </ul>
      ) : (
        <ul className="flex flex-col gap-2">
          {filteredEnvironments.map((e) => (
            <EnvironmentCard key={e.name} environment={e} world={world} onSpawn={handleSpawnEnvironment} />
          ))}
          {filteredEnvironments.length === 0 && (
            <li className={`${cardClass} text-center text-sm text-parchment/50`}>
              No environments match.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
