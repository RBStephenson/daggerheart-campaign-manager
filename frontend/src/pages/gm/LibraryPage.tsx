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
  type LibraryEntity,
  type LibraryEntityType,
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

const ENTITY_TYPES: { type: LibraryEntityType; label: string; singular: string }[] = [
  { type: 'regions', label: 'Regions', singular: 'Region' },
  { type: 'factions', label: 'Factions', singular: 'Faction' },
  { type: 'npcs', label: 'NPCs', singular: 'NPC' },
  { type: 'adversaries', label: 'Adversaries', singular: 'Adversary' },
];

function EntityPanel({
  worldId,
  type,
  singular,
}: {
  worldId: number;
  type: LibraryEntityType;
  singular: string;
}) {
  const [entities, setEntities] = useState<LibraryEntity[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setEntities(await listEntities(worldId, type));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const name = String(form.get('name') ?? '').trim();
    const summary = String(form.get('summary') ?? '').trim();
    const extra = String(form.get('extra') ?? '').trim();
    if (!name) return;
    await createEntity(worldId, type, { name, summary, extra });
    formEl.reset();
    await refresh();
  }

  async function handleUpdate(id: number, e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const summary = String(form.get('summary') ?? '').trim();
    const extra = String(form.get('extra') ?? '').trim();
    if (!name) return;
    await updateEntity(worldId, type, id, { name, summary, extra });
    setEditingId(null);
    await refresh();
  }

  async function handleDelete(id: number) {
    await deleteEntity(worldId, type, id);
    await refresh();
  }

  return (
    <div>
      <form onSubmit={(e) => void handleCreate(e)} className={`mb-6 flex max-w-md flex-col gap-2 ${cardClass}`}>
        <h2 className="mb-1 font-display text-sm tracking-wide text-parchment/80">
          New {singular}
        </h2>
        <input name="name" placeholder={`${singular} name`} required className={inputClass} />
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

export default function LibraryPage() {
  const [world, setWorld] = useState<World | null | undefined>(undefined);
  const [disabled, setDisabled] = useState(false);
  const [activeType, setActiveType] = useState<LibraryEntityType>('regions');

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
          Your world holds every Region, Faction, NPC, and Adversary you build here.
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
        {ENTITY_TYPES.map(({ type, label }) => (
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
      <EntityPanel
        key={activeType}
        worldId={world.id}
        type={activeType}
        singular={ENTITY_TYPES.find((t) => t.type === activeType)!.singular}
      />
    </div>
  );
}
