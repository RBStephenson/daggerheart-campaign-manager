import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import {
  createCampaign,
  deleteCampaign,
  endSession,
  listCampaigns,
  listSessions,
  startSession,
  updateCampaign,
  type Campaign,
  type GameSession,
} from '../../api/campaigns';

type ActiveSessions = Record<number, GameSession | undefined>;

export default function GamemasterPage() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [activeSessions, setActiveSessions] = useState<ActiveSessions>({});
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  async function refresh() {
    try {
      const list = await listCampaigns();
      setCampaigns(list);
      const sessionEntries = await Promise.all(
        list.map(async (c) => {
          const sessions = await listSessions(c.id);
          return [c.id, sessions.find((s) => s.status === 'active')] as const;
        }),
      );
      setActiveSessions(Object.fromEntries(sessionEntries));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setDisabled(true);
      } else {
        setError('Failed to load campaigns.');
        console.error(err);
      }
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
    const description = String(form.get('description') ?? '').trim();
    if (!name) return;
    await createCampaign(name, description);
    formEl.reset();
    await refresh();
  }

  async function handleUpdate(id: number, e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const description = String(form.get('description') ?? '').trim();
    if (!name) return;
    await updateCampaign(id, { name, description });
    setEditingId(null);
    await refresh();
  }

  async function handleDelete(id: number) {
    await deleteCampaign(id);
    await refresh();
  }

  async function handleStartSession(id: number) {
    await startSession(id);
    await refresh();
  }

  async function handleEndSession(campaignId: number, sessionId: number) {
    await endSession(campaignId, sessionId);
    await refresh();
  }

  if (disabled) {
    return (
      <section aria-label="Gamemaster">
        <h1 className="mb-4 text-2xl font-bold text-slate-900">Gamemaster</h1>
        <p className="text-slate-600">The campaigns feature is currently disabled.</p>
      </section>
    );
  }

  return (
    <section aria-label="Gamemaster">
      <h1 className="mb-4 text-2xl font-bold text-slate-900">Gamemaster</h1>
      {error && (
        <p role="alert" className="mb-4 text-sm text-red-600">
          {error}
        </p>
      )}

      <form onSubmit={(e) => void handleCreate(e)} className="mb-6 flex flex-col gap-2 max-w-md">
        <input
          name="name"
          placeholder="Campaign name"
          required
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
        <textarea
          name="description"
          placeholder="Description (optional)"
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
        <button
          type="submit"
          className="self-start rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Create campaign
        </button>
      </form>

      <ul className="flex flex-col gap-3">
        {campaigns?.map((campaign) => {
          const activeSession = activeSessions[campaign.id];
          return (
            <li
              key={campaign.id}
              className="rounded-md border border-slate-200 bg-white p-4"
            >
              {editingId === campaign.id ? (
                <form
                  onSubmit={(e) => void handleUpdate(campaign.id, e)}
                  className="flex flex-col gap-2"
                >
                  <input
                    name="name"
                    defaultValue={campaign.name}
                    required
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                  />
                  <textarea
                    name="description"
                    defaultValue={campaign.description}
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-md px-3 py-2 text-sm text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="break-words font-semibold text-slate-900">
                        {campaign.name}
                      </h2>
                      {campaign.description && (
                        <p className="break-words text-sm text-slate-600">
                          {campaign.description}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        activeSession
                          ? 'bg-green-100 text-green-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {activeSession ? 'Session active' : 'No active session'}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeSession ? (
                      <button
                        type="button"
                        onClick={() => void handleEndSession(campaign.id, activeSession.id)}
                        className="rounded-md bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
                      >
                        End session
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleStartSession(campaign.id)}
                        className="rounded-md bg-green-700 px-3 py-2 text-sm text-white hover:bg-green-800"
                      >
                        Start session
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingId(campaign.id)}
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(campaign.id)}
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          );
        })}
        {campaigns?.length === 0 && (
          <p className="text-slate-600">No campaigns yet. Create one above.</p>
        )}
      </ul>
    </section>
  );
}
