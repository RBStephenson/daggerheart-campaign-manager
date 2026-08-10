import { useEffect, useState, type FormEvent } from 'react';
import Badge from '../../components/ui/Badge';
import Skeleton from '../../components/ui/Skeleton';
import { ApiError } from '../../api/client';
import { useAppSettings } from '../../context/AppSettingsContext';
import ChatPanel from '../../components/ChatPanel';
import CountdownsPanel from './CountdownsPanel';
import FearTracker from './FearTracker';
import InvitePlayerPanel from './InvitePlayerPanel';
import MembersPanel from './MembersPanel';
import PartyPanel from './PartyPanel';
import SessionPlansPanel from './SessionPlansPanel';
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

const cardClass =
  'rounded-[12px] border border-hairline/15 bg-nightshade/60 p-5 backdrop-blur-sm';
const inputClass =
  'w-full rounded-md border border-hairline/20 bg-input-dark px-3 py-2 text-sm text-parchment placeholder:text-parchment/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember';
const ghostButtonClass =
  'rounded-md border border-hairline/20 px-3 py-2 text-sm text-parchment/70 transition-colors hover:bg-white/5 hover:text-parchment focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember';

export default function CampaignsPage() {
  const { settings } = useAppSettings();
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [activeSessions, setActiveSessions] = useState<ActiveSessions>({});
  const [disabled, setDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [planningCampaignId, setPlanningCampaignId] = useState<number | null>(null);
  const [membersCampaignId, setMembersCampaignId] = useState<number | null>(null);
  const [countdownsCampaignId, setCountdownsCampaignId] = useState<number | null>(null);
  const [partyCampaignId, setPartyCampaignId] = useState<number | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
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

  function handleFearChange(campaignId: number, fear: number) {
    setCampaigns((prev) =>
      prev?.map((c) => (c.id === campaignId ? { ...c, fear } : c)) ?? prev,
    );
  }

  if (disabled) {
    return <p className="text-parchment/60">The campaigns feature is currently disabled.</p>;
  }

  return (
    <div>
      {campaigns && (
        <p className="mb-4 text-sm text-parchment/50">{campaigns.length} campaigns</p>
      )}

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

      <InvitePlayerPanel />

      <form onSubmit={(e) => void handleCreate(e)} className={`mb-6 flex max-w-md flex-col gap-2 ${cardClass}`}>
        <h2 className="mb-1 font-display text-sm tracking-wide text-parchment/80">
          New Campaign
        </h2>
        <input name="name" placeholder="Campaign name" required className={inputClass} />
        <textarea name="description" placeholder="Description (optional)" className={inputClass} />
        <button
          type="submit"
          className="self-start rounded-md bg-ember px-4 py-2 text-sm font-semibold text-void transition-colors hover:bg-ember-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-bright"
        >
          Create campaign
        </button>
      </form>

      {loading ? (
        <ul className="flex flex-col gap-3" aria-label="Loading campaigns">
          {[0, 1, 2].map((i) => (
            <li key={i} className={cardClass}>
              <Skeleton className="mb-2 h-5 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-3">
          {campaigns?.map((campaign) => {
            const activeSession = activeSessions[campaign.id];
            return (
              <li key={campaign.id} className={cardClass}>
                {editingId === campaign.id ? (
                  <form
                    onSubmit={(e) => void handleUpdate(campaign.id, e)}
                    className="flex flex-col gap-2"
                  >
                    <input name="name" defaultValue={campaign.name} required className={inputClass} />
                    <textarea name="description" defaultValue={campaign.description} className={inputClass} />
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
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="break-words font-display text-base text-parchment">
                          {campaign.name}
                        </h2>
                        {campaign.description && (
                          <p className="break-words text-sm text-parchment/60">
                            {campaign.description}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {settings.combat_tools_enabled && (
                          <FearTracker
                            campaignId={campaign.id}
                            fear={campaign.fear}
                            onChange={(fear) => handleFearChange(campaign.id, fear)}
                          />
                        )}
                        <Badge variant={activeSession ? 'success' : 'neutral'}>
                          {activeSession ? 'Session active' : 'No active session'}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {activeSession ? (
                        <button
                          type="button"
                          onClick={() => void handleEndSession(campaign.id, activeSession.id)}
                          className="rounded-md border border-danger/50 px-3 py-2 text-sm text-danger-text transition-colors hover:bg-danger-bg/10"
                        >
                          End session
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleStartSession(campaign.id)}
                          className="rounded-md bg-ember px-3 py-2 text-sm font-semibold text-void hover:bg-ember-bright"
                        >
                          Start session
                        </button>
                      )}
                      <button type="button" onClick={() => setEditingId(campaign.id)} className={ghostButtonClass}>
                        Edit
                      </button>
                      <button type="button" onClick={() => void handleDelete(campaign.id)} className={ghostButtonClass}>
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPlanningCampaignId(
                            planningCampaignId === campaign.id ? null : campaign.id,
                          )
                        }
                        className={ghostButtonClass}
                      >
                        {planningCampaignId === campaign.id ? 'Hide session plans' : 'Session plans'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setMembersCampaignId(
                            membersCampaignId === campaign.id ? null : campaign.id,
                          )
                        }
                        className={ghostButtonClass}
                      >
                        {membersCampaignId === campaign.id ? 'Hide members' : 'Members'}
                      </button>
                      {settings.player_area_enabled && (
                        <button
                          type="button"
                          onClick={() =>
                            setPartyCampaignId(partyCampaignId === campaign.id ? null : campaign.id)
                          }
                          className={ghostButtonClass}
                        >
                          {partyCampaignId === campaign.id ? 'Hide party' : 'Party'}
                        </button>
                      )}
                      {settings.combat_tools_enabled && (
                        <button
                          type="button"
                          onClick={() =>
                            setCountdownsCampaignId(
                              countdownsCampaignId === campaign.id ? null : campaign.id,
                            )
                          }
                          className={ghostButtonClass}
                        >
                          {countdownsCampaignId === campaign.id ? 'Hide countdowns' : 'Countdowns'}
                        </button>
                      )}
                    </div>
                    {activeSession && <ChatPanel room={activeSession.room} />}
                    {planningCampaignId === campaign.id && (
                      <div className="mt-4 border-t border-hairline/15 pt-4">
                        <SessionPlansPanel campaignId={campaign.id} />
                      </div>
                    )}
                    {membersCampaignId === campaign.id && (
                      <div className="mt-4 border-t border-hairline/15 pt-4">
                        <MembersPanel campaignId={campaign.id} />
                      </div>
                    )}
                    {partyCampaignId === campaign.id && (
                      <div className="mt-4 border-t border-hairline/15 pt-4">
                        <PartyPanel campaignId={campaign.id} room={activeSession?.room ?? null} />
                      </div>
                    )}
                    {countdownsCampaignId === campaign.id && (
                      <div className="mt-4 border-t border-hairline/15 pt-4">
                        <CountdownsPanel campaignId={campaign.id} />
                      </div>
                    )}
                  </>
                )}
              </li>
            );
          })}
          {campaigns?.length === 0 && (
            <li className="rounded-[12px] border border-dashed border-hairline/25 p-6 text-center text-sm text-parchment/50">
              No campaigns yet. Create one above.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
