import { useEffect, useState, type FormEvent } from 'react';
import Badge from '../../components/ui/Badge';
import Skeleton from '../../components/ui/Skeleton';
import { ApiError } from '../../api/client';
import {
  createCharacter,
  deleteCharacter,
  getNote,
  listMyCampaigns,
  listMyCharacters,
  saveNote,
  type Character,
  type MemberCampaign,
} from '../../api/player';
import { getCharacterCreationData } from '../../api/srd';
import CharacterWizard from './CharacterWizard';

const cardClass = 'rounded-[12px] border border-hairline/15 bg-nightshade/60 p-5 backdrop-blur-sm';
const inputClass =
  'w-full rounded-md border border-hairline/20 bg-input-dark px-3 py-2 text-sm text-parchment placeholder:text-parchment/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember';

export default function PlayerPage() {
  const [disabled, setDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<MemberCampaign[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [wizardCampaignId, setWizardCampaignId] = useState<number | null>(null);
  // /api/settings is host-only (403 for players), so this can't come from
  // AppSettingsContext — probe the SRD endpoint itself and treat a 404 (flag
  // off) the same way every other player-area feature is gated: invisible.
  const [characterCreationAvailable, setCharacterCreationAvailable] = useState(false);

  const [noteCampaignId, setNoteCampaignId] = useState<number | null>(null);
  const [noteBody, setNoteBody] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [myCampaigns, myCharacters] = await Promise.all([
        listMyCampaigns(),
        listMyCharacters(),
      ]);
      setCampaigns(myCampaigns);
      setCharacters(myCharacters);
      setNoteCampaignId((current) => current ?? myCampaigns[0]?.id ?? null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setDisabled(true);
      } else {
        setError('Failed to load your data.');
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    getCharacterCreationData()
      .then(() => setCharacterCreationAvailable(true))
      .catch(() => setCharacterCreationAvailable(false));
  }, []);

  useEffect(() => {
    if (noteCampaignId === null) return;
    setNoteSaved(false);
    getNote(noteCampaignId)
      .then((note) => setNoteBody(note.body))
      .catch((err: unknown) => console.error('Failed to load note', err));
  }, [noteCampaignId]);

  async function handleCreateCharacter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const campaignId = Number(form.get('campaign_id'));
    const name = String(form.get('name') ?? '').trim();
    if (!campaignId || !name) return;
    await createCharacter({
      campaign_id: campaignId,
      name,
      char_class: String(form.get('char_class') ?? '').trim(),
      ancestry: String(form.get('ancestry') ?? '').trim(),
      community: String(form.get('community') ?? '').trim(),
      level: Number(form.get('level')) || 1,
    });
    formEl.reset();
    await refresh();
  }

  async function handleDeleteCharacter(id: number) {
    await deleteCharacter(id);
    await refresh();
  }

  async function handleSaveNote() {
    if (noteCampaignId === null) return;
    setNoteSaving(true);
    try {
      await saveNote(noteCampaignId, noteBody);
      setNoteSaved(true);
    } finally {
      setNoteSaving(false);
    }
  }

  function campaignName(id: number): string {
    return campaigns.find((c) => c.id === id)?.name ?? `Campaign ${id}`;
  }

  if (disabled) {
    return (
      <section
        aria-label="Player"
        className="relative left-1/2 -mt-6 -mb-6 w-screen -translate-x-1/2 bg-void px-4 py-10"
      >
        <div className="mx-auto max-w-5xl">
          <h1 className="font-display text-2xl text-parchment">Player</h1>
          <p className="mt-2 text-parchment/60">The player area is currently disabled.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Player"
      className="relative left-1/2 -mt-6 -mb-6 w-screen -translate-x-1/2 bg-void px-4 py-10"
    >
      <div className="relative mx-auto max-w-5xl">
        <h1 className="font-display text-2xl text-parchment">Player</h1>
        <p className="mb-6 text-sm text-parchment/50">Your campaigns, characters, and notes.</p>

        {error && (
          <div
            role="alert"
            className="mb-4 flex items-center justify-between gap-4 rounded-md border border-danger/50 bg-danger-bg/10 px-4 py-3 text-sm text-danger-text"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void refresh()}
              className="shrink-0 rounded-md border border-danger/50 px-3 py-1 text-xs font-medium text-danger-text hover:bg-danger-bg/20"
            >
              Retry
            </button>
          </div>
        )}

        <h2 className="mb-2 font-display text-sm tracking-wide text-parchment/70">
          My Campaigns
        </h2>
        {loading ? (
          <div className="mb-6 flex gap-2">
            <Skeleton className="h-7 w-28 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>
        ) : campaigns.length === 0 ? (
          <p className="mb-6 text-parchment/50">
            You haven't been added to a campaign yet. Ask your GM for an invite.
          </p>
        ) : (
          <ul className="mb-6 flex flex-wrap gap-2">
            {campaigns.map((c) => (
              <li key={c.id}>
                <Badge variant="violet">{c.name}</Badge>
              </li>
            ))}
          </ul>
        )}

        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-sm tracking-wide text-parchment/70">My Characters</h2>
          {characterCreationAvailable && campaigns.length > 0 && wizardCampaignId === null && (
            <button
              type="button"
              onClick={() => setWizardCampaignId(campaigns[0]?.id ?? null)}
              className="rounded-md bg-ember px-4 py-2 text-sm font-semibold text-void hover:bg-ember-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-bright"
            >
              Create Character (Guided)
            </button>
          )}
        </div>
        {characterCreationAvailable && campaigns.length > 0 && wizardCampaignId !== null && (
          <div className="mb-4">
            <CharacterWizard
              campaignId={wizardCampaignId}
              onCreated={() => {
                setWizardCampaignId(null);
                void refresh();
              }}
              onCancel={() => setWizardCampaignId(null)}
            />
          </div>
        )}
        {!characterCreationAvailable && campaigns.length > 0 && (
          <form
            onSubmit={(e) => void handleCreateCharacter(e)}
            className="mb-4 flex max-w-md flex-col gap-2"
          >
            <select name="campaign_id" required className={inputClass}>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input name="name" placeholder="Character name" required className={inputClass} />
            <div className="flex flex-wrap gap-2">
              <input name="char_class" placeholder="Class" className={`min-w-0 flex-1 ${inputClass}`} />
              <input name="ancestry" placeholder="Ancestry" className={`min-w-0 flex-1 ${inputClass}`} />
              <input name="community" placeholder="Community" className={`min-w-0 flex-1 ${inputClass}`} />
              <input
                name="level"
                type="number"
                min={1}
                max={20}
                defaultValue={1}
                className={`w-20 ${inputClass}`}
              />
            </div>
            <button
              type="submit"
              className="self-start rounded-md bg-ember px-4 py-2 text-sm font-semibold text-void hover:bg-ember-bright"
            >
              Create character
            </button>
          </form>
        )}
        {loading ? (
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className={cardClass}>
                <Skeleton className="mb-2 h-5 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : characters.length === 0 ? (
          <p className="mb-6 text-parchment/50">No characters yet.</p>
        ) : (
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {characters.map((c) => (
              <div key={c.id} className={`flex items-start justify-between gap-4 ${cardClass}`}>
                <div className="min-w-0">
                  <p className="break-words font-display text-base text-parchment">{c.name}</p>
                  <p className="break-words text-sm text-parchment/50">
                    {[c.char_class, c.ancestry, c.community].filter(Boolean).join(' · ') ||
                      'No details yet'}{' '}
                    · Level {c.level} · {campaignName(c.campaign_id)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDeleteCharacter(c.id)}
                  className="shrink-0 rounded-md border border-hairline/20 px-3 py-2 text-sm text-parchment/70 hover:bg-white/5 hover:text-parchment"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

        <h2 className="mb-2 font-display text-sm tracking-wide text-parchment/70">Notes</h2>
        {campaigns.length === 0 ? (
          <p className="text-parchment/50">Join a campaign to keep notes.</p>
        ) : (
          <div className="max-w-md">
            <select
              value={noteCampaignId ?? ''}
              onChange={(e) => setNoteCampaignId(Number(e.target.value))}
              className={`mb-2 ${inputClass}`}
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <textarea
              value={noteBody}
              onChange={(e) => {
                setNoteBody(e.target.value);
                setNoteSaved(false);
              }}
              rows={6}
              className={inputClass}
            />
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => void handleSaveNote()}
                disabled={noteSaving}
                className="rounded-md bg-ember px-4 py-2 text-sm font-semibold text-void hover:bg-ember-bright disabled:opacity-50"
              >
                {noteSaving ? 'Saving…' : 'Save note'}
              </button>
              {noteSaved && <span className="text-sm text-emerald-400">Saved.</span>}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
