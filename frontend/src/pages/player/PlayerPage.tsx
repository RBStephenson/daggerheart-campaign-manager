import { useEffect, useState, type FormEvent } from 'react';
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

export default function PlayerPage() {
  const [disabled, setDisabled] = useState(false);
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
      <section aria-label="Player">
        <h1 className="mb-4 text-2xl font-bold text-slate-900">Player</h1>
        <p className="text-slate-600">The player area is currently disabled.</p>
      </section>
    );
  }

  return (
    <section aria-label="Player">
      <h1 className="mb-4 text-2xl font-bold text-slate-900">Player</h1>
      {error && (
        <p role="alert" className="mb-4 text-sm text-red-600">
          {error}
        </p>
      )}

      <h2 className="mb-2 text-lg font-semibold text-slate-900">My Campaigns</h2>
      {campaigns.length === 0 ? (
        <p className="mb-6 text-slate-600">
          You haven't been added to a campaign yet. Ask your GM for an invite.
        </p>
      ) : (
        <ul className="mb-6 flex flex-col gap-1">
          {campaigns.map((c) => (
            <li key={c.id} className="text-sm text-slate-700">
              {c.name}
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-2 text-lg font-semibold text-slate-900">My Characters</h2>
      {characterCreationAvailable && campaigns.length > 0 && (
        <div className="mb-4">
          {wizardCampaignId === null ? (
            <button
              type="button"
              onClick={() => setWizardCampaignId(campaigns[0]?.id ?? null)}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Create Character (Guided)
            </button>
          ) : (
            <CharacterWizard
              campaignId={wizardCampaignId}
              onCreated={() => {
                setWizardCampaignId(null);
                void refresh();
              }}
              onCancel={() => setWizardCampaignId(null)}
            />
          )}
        </div>
      )}
      {!characterCreationAvailable && campaigns.length > 0 && (
        <form
          onSubmit={(e) => void handleCreateCharacter(e)}
          className="mb-4 flex max-w-md flex-col gap-2"
        >
          <select
            name="campaign_id"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            name="name"
            placeholder="Character name"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
          <div className="flex flex-wrap gap-2">
            <input
              name="char_class"
              placeholder="Class"
              className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2"
            />
            <input
              name="ancestry"
              placeholder="Ancestry"
              className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2"
            />
            <input
              name="community"
              placeholder="Community"
              className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2"
            />
            <input
              name="level"
              type="number"
              min={1}
              max={20}
              defaultValue={1}
              className="w-20 rounded-md border border-slate-300 px-3 py-2"
            />
          </div>
          <button
            type="submit"
            className="self-start rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Create character
          </button>
        </form>
      )}
      {characters.length === 0 ? (
        <p className="mb-6 text-slate-600">No characters yet.</p>
      ) : (
        <ul className="mb-6 flex flex-col gap-2">
          {characters.map((c) => (
            <li
              key={c.id}
              className="flex items-start justify-between gap-4 rounded-md border border-slate-200 bg-white p-4"
            >
              <div className="min-w-0">
                <p className="break-words font-semibold text-slate-900">{c.name}</p>
                <p className="break-words text-sm text-slate-600">
                  {[c.char_class, c.ancestry, c.community].filter(Boolean).join(' · ') ||
                    'No details yet'}{' '}
                  · Level {c.level} · {campaignName(c.campaign_id)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleDeleteCharacter(c.id)}
                className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-2 text-lg font-semibold text-slate-900">Notes</h2>
      {campaigns.length === 0 ? (
        <p className="text-slate-600">Join a campaign to keep notes.</p>
      ) : (
        <div className="max-w-md">
          <select
            value={noteCampaignId ?? ''}
            onChange={(e) => setNoteCampaignId(Number(e.target.value))}
            className="mb-2 w-full rounded-md border border-slate-300 px-3 py-2"
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
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSaveNote()}
              disabled={noteSaving}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {noteSaving ? 'Saving…' : 'Save note'}
            </button>
            {noteSaved && <span className="text-sm text-green-700">Saved.</span>}
          </div>
        </div>
      )}
    </section>
  );
}
