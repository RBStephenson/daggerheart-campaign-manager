import { useEffect, useState, type FormEvent } from 'react';
import Skeleton from '../../components/ui/Skeleton';
import { ApiError } from '../../api/client';
import { listEntities, listWorlds, type LibraryEntity } from '../../api/library';
import {
  createLink,
  createSessionPlan,
  deleteLink,
  deleteSessionPlan,
  listLinks,
  listSessionPlans,
  updateSessionPlan,
  type LibraryEntityType,
  type SessionPlan,
  type SessionPlanContent,
  type SessionPlanLibraryLink,
} from '../../api/sessionPlans';

// opening/reward/notes/hooks/beats/countdowns all get their own inputs now.
// Whatever's left is a genuinely unmodeled key (the schema's `extra="allow"`
// catch-all) — never shown or editable here, but carried forward unchanged
// via a hidden `content-extra` field so retiring the JSON textarea doesn't
// silently drop it on the next save.
function contentRest(content: SessionPlanContent): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...content };
  delete rest.opening;
  delete rest.reward;
  delete rest.notes;
  delete rest.hooks;
  delete rest.beats;
  delete rest.countdowns;
  return rest;
}

function parseContentExtra(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

type Beat = NonNullable<SessionPlanContent['beats']>[number];
type Countdown = NonNullable<SessionPlanContent['countdowns']>[number];

const cardClass =
  'rounded-[12px] border border-hairline/15 bg-nightshade/60 p-5 backdrop-blur-sm';
const inputClass =
  'w-full rounded-md border border-hairline/20 bg-input-dark px-3 py-2 text-sm text-parchment placeholder:text-parchment/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember';
const ghostButtonClass =
  'rounded-md border border-hairline/20 px-3 py-2 text-sm text-parchment/70 transition-colors hover:bg-white/5 hover:text-parchment focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember';

// Regions/Locations aren't listable directly off a world (they hang off a
// Continent/Region respectively), so the link picker has to walk the
// hierarchy and flatten it to get "every Region/Location in this world".
async function listAllRegions(worldId: number): Promise<LibraryEntity[]> {
  const continents = await listEntities('continents', worldId);
  const perContinent = await Promise.all(continents.map((c) => listEntities('regions', c.id)));
  return perContinent.flat();
}

async function listAllLocations(worldId: number): Promise<LibraryEntity[]> {
  const regions = await listAllRegions(worldId);
  const perRegion = await Promise.all(regions.map((r) => listEntities('locations', r.id)));
  return perRegion.flat();
}

const LINK_TYPES: {
  type: LibraryEntityType;
  label: string;
  list: (worldId: number) => Promise<LibraryEntity[]>;
}[] = [
  { type: 'continent', label: 'Continent', list: (w) => listEntities('continents', w) },
  { type: 'region', label: 'Region', list: (w) => listAllRegions(w) },
  { type: 'location', label: 'Location', list: (w) => listAllLocations(w) },
  { type: 'faction', label: 'Faction', list: (w) => listEntities('factions', w) },
  { type: 'npc', label: 'NPC', list: (w) => listEntities('npcs', w) },
  { type: 'adversary', label: 'Adversary', list: (w) => listEntities('adversaries', w) },
];

const EMPTY_ENTITIES_BY_TYPE: Record<LibraryEntityType, LibraryEntity[]> = {
  continent: [],
  region: [],
  location: [],
  faction: [],
  npc: [],
  adversary: [],
};

// Renders as repeated `name="hooks"` inputs so the surrounding form's
// FormData.getAll('hooks') collects them in order on submit, keeping this
// consistent with the rest of the panel's uncontrolled-form pattern.
function HooksListEditor({ initial }: { initial: string[] }) {
  const [hooks, setHooks] = useState<string[]>(initial.length ? initial : ['']);

  function updateHook(index: number, value: string) {
    setHooks((prev) => prev.map((hook, i) => (i === index ? value : hook)));
  }

  function addHook() {
    setHooks((prev) => [...prev, '']);
  }

  function removeHook(index: number) {
    setHooks((prev) => (prev.length === 1 ? [''] : prev.filter((_, i) => i !== index)));
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-parchment/50">Hooks (optional)</span>
      {hooks.map((hook, i) => (
        <div key={i} className="flex gap-2">
          <input
            name="hooks"
            value={hook}
            onChange={(e) => updateHook(i, e.target.value)}
            placeholder="Hook"
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => removeHook(i)}
            aria-label={`Remove hook ${i + 1}`}
            className={ghostButtonClass}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" onClick={addHook} className={`${ghostButtonClass} self-start`}>
        Add hook
      </button>
    </div>
  );
}

// Renders name/description as repeated `name="beats-name"`/`name="beats-description"`
// inputs, zipped by index on submit — same FormData convention as
// HooksListEditor. `npc_ids` isn't editable from this UI yet (DHCM-70 scope),
// but has to survive a save unchanged, so each row also carries a hidden
// `name="beats-npc-ids"` input holding its original value untouched.
function BeatsListEditor({ initial }: { initial: Beat[] }) {
  const emptyBeat: Beat = { name: '' };
  const [beats, setBeats] = useState<Beat[]>(initial.length ? initial : [emptyBeat]);

  function updateBeat(index: number, patch: Partial<Beat>) {
    setBeats((prev) => prev.map((beat, i) => (i === index ? { ...beat, ...patch } : beat)));
  }

  function addBeat() {
    setBeats((prev) => [...prev, emptyBeat]);
  }

  function removeBeat(index: number) {
    setBeats((prev) => (prev.length === 1 ? [emptyBeat] : prev.filter((_, i) => i !== index)));
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-parchment/50">Beats (optional)</span>
      {beats.map((beat, i) => (
        <div key={i} className="flex flex-col gap-1 rounded-md border border-hairline/15 p-2">
          <div className="flex gap-2">
            <input
              name="beats-name"
              value={beat.name}
              onChange={(e) => updateBeat(i, { name: e.target.value })}
              placeholder="Beat name"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => removeBeat(i)}
              aria-label={`Remove beat ${i + 1}`}
              className={ghostButtonClass}
            >
              ×
            </button>
          </div>
          <textarea
            name="beats-description"
            value={beat.description ?? ''}
            onChange={(e) => updateBeat(i, { description: e.target.value })}
            placeholder="Beat description (optional)"
            className={inputClass}
          />
          <input type="hidden" name="beats-npc-ids" value={JSON.stringify(beat.npc_ids ?? [])} />
        </div>
      ))}
      <button type="button" onClick={addBeat} className={`${ghostButtonClass} self-start`}>
        Add beat
      </button>
    </div>
  );
}

// Same FormData-zip-by-index convention as Hooks/Beats, extended to five
// parallel fields per row instead of one or two.
function CountdownsListEditor({ initial }: { initial: Countdown[] }) {
  const emptyCountdown: Countdown = { name: '', max_segments: 4 };
  const [countdowns, setCountdowns] = useState<Countdown[]>(initial.length ? initial : [emptyCountdown]);

  function updateCountdown(index: number, patch: Partial<Countdown>) {
    setCountdowns((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function addCountdown() {
    setCountdowns((prev) => [...prev, emptyCountdown]);
  }

  function removeCountdown(index: number) {
    setCountdowns((prev) => (prev.length === 1 ? [emptyCountdown] : prev.filter((_, i) => i !== index)));
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-parchment/50">Countdowns (optional)</span>
      {countdowns.map((countdown, i) => (
        <div key={i} className="flex flex-col gap-1 rounded-md border border-hairline/15 p-2">
          <div className="flex gap-2">
            <input
              name="countdowns-name"
              value={countdown.name}
              onChange={(e) => updateCountdown(i, { name: e.target.value })}
              placeholder="Countdown name"
              className={inputClass}
            />
            <input
              name="countdowns-max-segments"
              type="number"
              min={1}
              value={countdown.max_segments}
              onChange={(e) => updateCountdown(i, { max_segments: Number(e.target.value) })}
              placeholder="Segments"
              aria-label={`Countdown ${i + 1} segments`}
              className={`${inputClass} w-24`}
            />
            <button
              type="button"
              onClick={() => removeCountdown(i)}
              aria-label={`Remove countdown ${i + 1}`}
              className={ghostButtonClass}
            >
              ×
            </button>
          </div>
          <input
            name="countdowns-trigger"
            value={countdown.trigger ?? ''}
            onChange={(e) => updateCountdown(i, { trigger: e.target.value })}
            placeholder="Trigger — what ticks this countdown (optional)"
            className={inputClass}
          />
          <textarea
            name="countdowns-on-complete"
            value={countdown.on_complete ?? ''}
            onChange={(e) => updateCountdown(i, { on_complete: e.target.value })}
            placeholder="On complete (optional)"
            className={inputClass}
          />
          <textarea
            name="countdowns-on-intervention"
            value={countdown.on_intervention ?? ''}
            onChange={(e) => updateCountdown(i, { on_intervention: e.target.value })}
            placeholder="On intervention (optional)"
            className={inputClass}
          />
        </div>
      ))}
      <button type="button" onClick={addCountdown} className={`${ghostButtonClass} self-start`}>
        Add countdown
      </button>
    </div>
  );
}

function LinksSection({ campaignId, planId }: { campaignId: number; planId: number }) {
  const [links, setLinks] = useState<SessionPlanLibraryLink[] | null>(null);
  const [worldId, setWorldId] = useState<number | null>(null);
  const [entityType, setEntityType] = useState<LibraryEntityType>('continent');
  const [entitiesByType, setEntitiesByType] =
    useState<Record<LibraryEntityType, LibraryEntity[]>>(EMPTY_ENTITIES_BY_TYPE);
  const [error, setError] = useState<string | null>(null);

  async function refreshLinks() {
    setLinks(await listLinks(campaignId, planId));
  }

  useEffect(() => {
    void refreshLinks();
    listWorlds()
      .then((worlds) => setWorldId(worlds[0]?.id ?? null))
      .catch(() => setWorldId(null));
  }, []);

  useEffect(() => {
    if (worldId === null) return;
    Promise.all(LINK_TYPES.map(({ list }) => list(worldId)))
      .then((results) => {
        const byType = { ...EMPTY_ENTITIES_BY_TYPE };
        LINK_TYPES.forEach(({ type }, i) => {
          byType[type] = results[i];
        });
        setEntitiesByType(byType);
      })
      .catch(() => setEntitiesByType(EMPTY_ENTITIES_BY_TYPE));
  }, [worldId]);

  function entityName(type: LibraryEntityType, id: number): string {
    const label = LINK_TYPES.find((t) => t.type === type)!.label;
    const entity = entitiesByType[type].find((e) => e.id === id);
    return entity ? `${label}: ${entity.name}` : `${label} #${id}`;
  }

  async function handleAttach(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const entityId = Number(form.get('entity_id'));
    if (!entityId) return;
    try {
      await createLink(campaignId, planId, { entity_type: entityType, entity_id: entityId });
      await refreshLinks();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to attach.');
    }
  }

  async function handleRemove(linkId: number) {
    await deleteLink(campaignId, planId, linkId);
    await refreshLinks();
  }

  return (
    <div className="mt-4 border-t border-hairline/15 pt-4">
      <h4 className="mb-2 font-display text-sm tracking-wide text-parchment/70">Library links</h4>
      {error && <p className="mb-2 text-sm text-danger-text">{error}</p>}
      <ul className="mb-3 flex flex-wrap gap-2">
        {links?.map((link) => (
          <li
            key={link.id}
            className="flex items-center gap-2 rounded-md border border-hairline/20 px-2 py-1 text-xs text-parchment/70"
          >
            {entityName(link.entity_type, link.entity_id)}
            <button
              type="button"
              onClick={() => void handleRemove(link.id)}
              aria-label={`Remove ${entityName(link.entity_type, link.entity_id)}`}
              className="text-parchment/40 hover:text-danger-text"
            >
              ×
            </button>
          </li>
        ))}
        {links?.length === 0 && <li className="text-xs text-parchment/40">No Library entities attached yet.</li>}
      </ul>
      <form onSubmit={(e) => void handleAttach(e)} className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Entity type"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value as LibraryEntityType)}
          className={`${inputClass} w-auto`}
        >
          {LINK_TYPES.map(({ type, label }) => (
            <option key={type} value={type}>
              {label}
            </option>
          ))}
        </select>
        <select
          name="entity_id"
          aria-label="Library entity"
          defaultValue=""
          required
          className={`${inputClass} w-auto`}
        >
          <option value="" disabled>
            Choose {LINK_TYPES.find((t) => t.type === entityType)!.label.toLowerCase()}...
          </option>
          {entitiesByType[entityType].map((entity) => (
            <option key={entity.id} value={entity.id}>
              {entity.name}
            </option>
          ))}
        </select>
        <button type="submit" className={ghostButtonClass}>
          Attach
        </button>
      </form>
    </div>
  );
}

export default function SessionPlansPanel({ campaignId }: { campaignId: number }) {
  const [plans, setPlans] = useState<SessionPlan[] | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [createFormGen, setCreateFormGen] = useState(0);

  async function refresh() {
    setLoading(true);
    try {
      setPlans(await listSessionPlans(campaignId));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setDisabled(true);
      } else {
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function buildBeats(form: FormData): SessionPlanContent['beats'] {
    const names = form.getAll('beats-name').map(String);
    const descriptions = form.getAll('beats-description').map(String);
    const npcIdsRaw = form.getAll('beats-npc-ids').map(String);
    return names.flatMap((rawName, i) => {
      const name = rawName.trim();
      if (!name) return [];
      const beat: Beat = { name };
      const description = (descriptions[i] ?? '').trim();
      if (description) beat.description = description;
      try {
        const parsed: unknown = JSON.parse(npcIdsRaw[i] || '[]');
        if (Array.isArray(parsed) && parsed.length > 0) beat.npc_ids = parsed as number[];
      } catch {
        // malformed hidden field (shouldn't happen outside a test/devtools edit) — drop npc_ids
      }
      return [beat];
    });
  }

  function buildCountdowns(form: FormData): SessionPlanContent['countdowns'] {
    const names = form.getAll('countdowns-name').map(String);
    const maxSegments = form.getAll('countdowns-max-segments').map(String);
    const triggers = form.getAll('countdowns-trigger').map(String);
    const onCompletes = form.getAll('countdowns-on-complete').map(String);
    const onInterventions = form.getAll('countdowns-on-intervention').map(String);
    return names.flatMap((rawName, i) => {
      const name = rawName.trim();
      if (!name) return [];
      const segments = Number(maxSegments[i]);
      const countdown: Countdown = {
        name,
        max_segments: Number.isFinite(segments) && segments > 0 ? segments : 1,
      };
      const trigger = (triggers[i] ?? '').trim();
      if (trigger) countdown.trigger = trigger;
      const onComplete = (onCompletes[i] ?? '').trim();
      if (onComplete) countdown.on_complete = onComplete;
      const onIntervention = (onInterventions[i] ?? '').trim();
      if (onIntervention) countdown.on_intervention = onIntervention;
      return [countdown];
    });
  }

  function buildContent(form: FormData): SessionPlanContent {
    const extra = parseContentExtra(String(form.get('content-extra') ?? '{}'));
    const hooks = form
      .getAll('hooks')
      .map((h) => String(h).trim())
      .filter(Boolean);
    return {
      ...extra,
      opening: String(form.get('opening') ?? '').trim(),
      hooks,
      beats: buildBeats(form),
      countdowns: buildCountdowns(form),
      reward: String(form.get('reward') ?? '').trim(),
      notes: String(form.get('notes') ?? '').trim(),
    };
  }

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const title = String(form.get('title') ?? '').trim();
    const summary = String(form.get('summary') ?? '').trim();
    const order = Number(form.get('order') ?? 0);
    if (!title) return;
    const content = buildContent(form);
    try {
      await createSessionPlan(campaignId, { title, summary, order, content });
      formEl.reset();
      setCreateFormGen((gen) => gen + 1);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create session plan.');
    }
  }

  async function handleUpdate(id: number, e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const title = String(form.get('title') ?? '').trim();
    const summary = String(form.get('summary') ?? '').trim();
    const order = Number(form.get('order') ?? 0);
    if (!title) return;
    const content = buildContent(form);
    try {
      await updateSessionPlan(campaignId, id, { title, summary, order, content });
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update session plan.');
    }
  }

  async function handleDelete(id: number) {
    await deleteSessionPlan(campaignId, id);
    await refresh();
  }

  if (disabled) {
    return <p className="text-sm text-parchment/60">Session planning is currently disabled.</p>;
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
        <h3 className="mb-1 font-display text-sm tracking-wide text-parchment/80">New Session Plan</h3>
        <input name="title" placeholder="Session title" required className={inputClass} />
        <textarea name="summary" placeholder="Summary (optional)" className={inputClass} />
        <input name="order" type="number" placeholder="Order" defaultValue={0} className={inputClass} />
        <textarea name="opening" placeholder="Opening (optional) — how the session starts" className={inputClass} />
        <HooksListEditor key={`hooks-${createFormGen}`} initial={[]} />
        <BeatsListEditor key={`beats-${createFormGen}`} initial={[]} />
        <CountdownsListEditor key={`countdowns-${createFormGen}`} initial={[]} />
        <textarea name="reward" placeholder="Reward (optional) — the payoff" className={inputClass} />
        <textarea name="notes" placeholder="Notes (optional)" className={inputClass} />
        <button
          type="submit"
          className="self-start rounded-md bg-ember px-4 py-2 text-sm font-semibold text-void transition-colors hover:bg-ember-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-bright"
        >
          Create session plan
        </button>
      </form>

      {loading ? (
        <ul className="flex flex-col gap-3" aria-label="Loading session plans">
          {[0, 1].map((i) => (
            <li key={i} className={cardClass}>
              <Skeleton className="mb-2 h-5 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-3">
          {plans?.map((plan) => (
            <li key={plan.id} className={cardClass}>
              {editingId === plan.id ? (
                <form onSubmit={(e) => void handleUpdate(plan.id, e)} className="flex flex-col gap-2">
                  <input name="title" defaultValue={plan.title} required className={inputClass} />
                  <textarea name="summary" defaultValue={plan.summary} className={inputClass} />
                  <input name="order" type="number" defaultValue={plan.order} className={inputClass} />
                  <textarea
                    name="opening"
                    defaultValue={plan.content.opening ?? ''}
                    placeholder="Opening (optional) — how the session starts"
                    className={inputClass}
                  />
                  <HooksListEditor initial={plan.content.hooks ?? []} />
                  <BeatsListEditor initial={plan.content.beats ?? []} />
                  <CountdownsListEditor initial={plan.content.countdowns ?? []} />
                  <input
                    type="hidden"
                    name="content-extra"
                    value={JSON.stringify(contentRest(plan.content))}
                    readOnly
                  />
                  <textarea
                    name="reward"
                    defaultValue={plan.content.reward ?? ''}
                    placeholder="Reward (optional) — the payoff"
                    className={inputClass}
                  />
                  <textarea
                    name="notes"
                    defaultValue={plan.content.notes ?? ''}
                    placeholder="Notes (optional)"
                    className={inputClass}
                  />
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
                  <h3 className="break-words font-display text-base text-parchment">{plan.title}</h3>
                  {plan.summary && <p className="break-words text-sm text-parchment/60">{plan.summary}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setEditingId(plan.id)} className={ghostButtonClass}>
                      Edit
                    </button>
                    <button type="button" onClick={() => void handleDelete(plan.id)} className={ghostButtonClass}>
                      Delete
                    </button>
                  </div>
                  <LinksSection campaignId={campaignId} planId={plan.id} />
                </>
              )}
            </li>
          ))}
          {plans?.length === 0 && (
            <li className="rounded-[12px] border border-dashed border-hairline/25 p-6 text-center text-sm text-parchment/50">
              No session plans yet. Create one above.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
