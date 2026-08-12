import { useEffect, useState, type FormEvent } from 'react';
import Skeleton from '../../components/ui/Skeleton';
import { ApiError } from '../../api/client';
import {
  createEntity,
  createWorld,
  deleteEntity,
  listEntities,
  listWorlds,
  updateEntity,
  SEGMENT_HAS_KIND,
  type LibraryEntity,
  type LibrarySegment,
  type World,
} from '../../api/library';

const cardClass =
  'rounded-[12px] border border-hairline/15 bg-nightshade/60 p-5 backdrop-blur-sm';
const inputClass =
  'w-full rounded-md border border-hairline/20 bg-input-dark px-3 py-2 text-sm text-parchment placeholder:text-parchment/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember';
const ghostButtonClass =
  'rounded-md border border-hairline/20 px-3 py-2 text-sm text-parchment/70 transition-colors hover:bg-white/5 hover:text-parchment focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember';
const tabClass = (active: boolean) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    active ? 'bg-ember/20 text-ember-bright' : 'text-parchment/60 hover:bg-white/5 hover:text-parchment'
  }`;

// Top-level Library tabs. Continents is the entry point into the place
// hierarchy (World > Continent > Region > Location); Factions/NPCs/
// Adversaries stay flat, scoped directly to the world.
const TOP_LEVEL_TABS: { type: LibrarySegment; label: string }[] = [
  { type: 'continents', label: 'Continents' },
  { type: 'factions', label: 'Factions' },
  { type: 'npcs', label: 'NPCs' },
  { type: 'adversaries', label: 'Adversaries' },
  { type: 'environments', label: 'Environments' },
];

const SINGULAR: Record<LibrarySegment, string> = {
  continents: 'Continent',
  regions: 'Region',
  locations: 'Location',
  factions: 'Faction',
  npcs: 'NPC',
  adversaries: 'Adversary',
  environments: 'Environment',
};

const CHILD_SEGMENT: Partial<Record<LibrarySegment, LibrarySegment>> = {
  continents: 'regions',
  regions: 'locations',
};

function EntityPanel({
  segment,
  parentId,
  onDrillIn,
}: {
  segment: LibrarySegment;
  parentId: number;
  onDrillIn?: (entity: LibraryEntity) => void;
}) {
  const singular = SINGULAR[segment];
  const hasKind = SEGMENT_HAS_KIND[segment];
  const childSegment = CHILD_SEGMENT[segment];
  const [entities, setEntities] = useState<LibraryEntity[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setEntities(await listEntities(segment, parentId));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [segment, parentId]);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const name = String(form.get('name') ?? '').trim();
    const summary = String(form.get('summary') ?? '').trim();
    const extra = String(form.get('extra') ?? '').trim();
    const kind = String(form.get('kind') ?? '').trim();
    if (!name) return;
    await createEntity(segment, parentId, hasKind ? { name, summary, extra, kind } : { name, summary, extra });
    formEl.reset();
    await refresh();
  }

  async function handleUpdate(id: number, e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const summary = String(form.get('summary') ?? '').trim();
    const extra = String(form.get('extra') ?? '').trim();
    const kind = String(form.get('kind') ?? '').trim();
    if (!name) return;
    await updateEntity(segment, parentId, id, hasKind ? { name, summary, extra, kind } : { name, summary, extra });
    setEditingId(null);
    await refresh();
  }

  async function handleDelete(id: number) {
    await deleteEntity(segment, parentId, id);
    await refresh();
  }

  return (
    <div>
      <form onSubmit={(e) => void handleCreate(e)} className={`mb-6 flex max-w-md flex-col gap-2 ${cardClass}`}>
        <h2 className="mb-1 font-display text-sm tracking-wide text-parchment/80">
          New {singular}
        </h2>
        <input name="name" placeholder={`${singular} name`} required className={inputClass} />
        {hasKind && <input name="kind" placeholder="Kind (optional, e.g. town, ruin)" className={inputClass} />}
        <textarea name="summary" placeholder="Summary (optional)" className={inputClass} />
        <textarea name="extra" placeholder="Notes (optional)" className={inputClass} />
        <button
          type="submit"
          className="self-start rounded-md bg-ember px-4 py-2 text-sm font-semibold text-void transition-colors hover:bg-ember-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-bright"
        >
          Create {singular.toLowerCase()}
        </button>
      </form>

      {loading ? (
        <ul className="flex flex-col gap-3" aria-label={`Loading ${singular.toLowerCase()}s`}>
          {[0, 1].map((i) => (
            <li key={i} className={cardClass}>
              <Skeleton className="mb-2 h-5 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-3">
          {entities?.map((entity) => (
            <li key={entity.id} className={cardClass}>
              {editingId === entity.id ? (
                <form onSubmit={(e) => void handleUpdate(entity.id, e)} className="flex flex-col gap-2">
                  <input name="name" defaultValue={entity.name} required className={inputClass} />
                  {hasKind && (
                    <input name="kind" defaultValue={entity.kind ?? ''} placeholder="Kind" className={inputClass} />
                  )}
                  <textarea name="summary" defaultValue={entity.summary} className={inputClass} />
                  <textarea name="extra" defaultValue={entity.extra} className={inputClass} />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="rounded-md bg-ember px-3 py-2 text-sm font-semibold text-void hover:bg-ember-bright"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-md px-3 py-2 text-sm text-parchment/60 hover:text-parchment"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <h3 className="break-words font-display text-base text-parchment">{entity.name}</h3>
                  {entity.kind && <p className="text-xs uppercase tracking-wide text-parchment/40">{entity.kind}</p>}
                  {entity.summary && (
                    <p className="break-words text-sm text-parchment/60">{entity.summary}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setEditingId(entity.id)} className={ghostButtonClass}>
                      Edit
                    </button>
                    <button type="button" onClick={() => void handleDelete(entity.id)} className={ghostButtonClass}>
                      Delete
                    </button>
                    {onDrillIn && childSegment && (
                      <button type="button" onClick={() => onDrillIn(entity)} className={ghostButtonClass}>
                        View {SINGULAR[childSegment]}s
                      </button>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
          {entities?.length === 0 && (
            <li className="rounded-[12px] border border-dashed border-hairline/25 p-6 text-center text-sm text-parchment/50">
              No {singular.toLowerCase()}s yet. Create one above.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

type PlaceNav =
  | { level: 'continents' }
  | { level: 'regions'; continent: LibraryEntity }
  | { level: 'locations'; continent: LibraryEntity; region: LibraryEntity };

function PlaceHierarchyPanel({ worldId }: { worldId: number }) {
  const [nav, setNav] = useState<PlaceNav>({ level: 'continents' });

  if (nav.level === 'continents') {
    return (
      <EntityPanel
        key="continents"
        segment="continents"
        parentId={worldId}
        onDrillIn={(continent) => setNav({ level: 'regions', continent })}
      />
    );
  }

  if (nav.level === 'regions') {
    return (
      <div>
        <button
          type="button"
          onClick={() => setNav({ level: 'continents' })}
          className="mb-4 text-sm text-parchment/50 hover:text-parchment"
        >
          &larr; Continents
        </button>
        <p className="mb-3 text-xs uppercase tracking-wide text-parchment/40">
          {nav.continent.name} &rsaquo; Regions
        </p>
        <EntityPanel
          key={`regions-${nav.continent.id}`}
          segment="regions"
          parentId={nav.continent.id}
          onDrillIn={(region) => setNav({ level: 'locations', continent: nav.continent, region })}
        />
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setNav({ level: 'regions', continent: nav.continent })}
        className="mb-4 text-sm text-parchment/50 hover:text-parchment"
      >
        &larr; {nav.continent.name} Regions
      </button>
      <p className="mb-3 text-xs uppercase tracking-wide text-parchment/40">
        {nav.continent.name} &rsaquo; {nav.region.name} &rsaquo; Locations
      </p>
      <EntityPanel key={`locations-${nav.region.id}`} segment="locations" parentId={nav.region.id} />
    </div>
  );
}

// EntityPanel needs a real worldId for the flat segments (factions/npcs/
// adversaries) and the Continents entry point of the place hierarchy; this
// small wrapper just threads the resolved world id through.
function WorldScopedPanel({ worldId, segment }: { worldId: number; segment: LibrarySegment }) {
  if (segment === 'continents') {
    return <PlaceHierarchyPanel worldId={worldId} />;
  }
  return <EntityPanel key={segment} segment={segment} parentId={worldId} />;
}

export default function LibraryPage() {
  const [world, setWorld] = useState<World | null | undefined>(undefined);
  const [disabled, setDisabled] = useState(false);
  const [activeType, setActiveType] = useState<LibrarySegment>('continents');

  async function loadWorld() {
    try {
      const worlds = await listWorlds();
      setWorld(worlds[0] ?? null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setDisabled(true);
      } else {
        console.error(err);
      }
    }
  }

  useEffect(() => {
    void loadWorld();
  }, []);

  async function handleCreateWorld(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    if (!name) return;
    setWorld(await createWorld(name));
  }

  if (disabled) {
    return <p className="text-parchment/60">The library feature is currently disabled.</p>;
  }

  if (world === undefined) {
    return (
      <div className={cardClass}>
        <Skeleton className="mb-2 h-5 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (world === null) {
    return (
      <form onSubmit={(e) => void handleCreateWorld(e)} className={`flex max-w-md flex-col gap-2 ${cardClass}`}>
        <h2 className="mb-1 font-display text-sm tracking-wide text-parchment/80">
          Name your world
        </h2>
        <p className="mb-1 text-sm text-parchment/50">
          Your world holds every Continent, Region, Location, Faction, NPC, and Adversary you
          build here.
        </p>
        <input name="name" placeholder="World name" required className={inputClass} />
        <button
          type="submit"
          className="self-start rounded-md bg-ember px-4 py-2 text-sm font-semibold text-void transition-colors hover:bg-ember-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-bright"
        >
          Create world
        </button>
      </form>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1">
        {TOP_LEVEL_TABS.map(({ type, label }) => (
          <button
            key={type}
            type="button"
            onClick={() => setActiveType(type)}
            className={tabClass(activeType === type)}
          >
            {label}
          </button>
        ))}
      </div>
      <WorldScopedPanel key={activeType} worldId={world.id} segment={activeType} />
    </div>
  );
}
