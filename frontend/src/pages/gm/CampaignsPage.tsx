import { useEffect, useState, type FormEvent } from 'react';
import Skeleton from '../../components/ui/Skeleton';
import { ApiError } from '../../api/client';
import { useAppSettings } from '../../context/AppSettingsContext';
import CampaignDetailPane from './CampaignDetailPane';
import InvitePlayerPanel from './InvitePlayerPanel';
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
  'rounded-[12px] border border-hairline/15 bg-nightshade/60 p-4 backdrop-blur-sm';
const inputClass =
  'w-full rounded-md border border-hairline/20 bg-input-dark px-3 py-2 text-sm text-parchment placeholder:text-parchment/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember';

function fearDots(fear: number) {
  return Array.from({ length: 12 }, (_, i) => (
    <span
      key={i}
      className={`h-1.5 w-1.5 rounded-full ${i < fear ? 'bg-ember' : 'bg-white/10'}`}
    />
  ));
}

export default function CampaignsPage() {
  const { settings } = useAppSettings();
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [activeSessions, setActiveSessions] = useState<ActiveSessions>({});
  const [disabled, setDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

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

  function openCampaign(id: number) {
    setSelectedId(id);
  }

  function closeDetail() {
    setSelectedId(null);
  }

  function openNewForm() {
    setEditingId(null);
    setShowFormModal(true);
  }

  function openEditForm(id: number) {
    setEditingId(id);
    setShowFormModal(true);
  }

  function closeForm() {
    setShowFormModal(false);
    setEditingId(null);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const name = String(form.get('name') ?? '').trim();
    const description = String(form.get('description') ?? '').trim();
    if (!name) return;
    if (editingId != null) {
      await updateCampaign(editingId, { name, description });
    } else {
      await createCampaign(name, description);
    }
    closeForm();
    await refresh();
  }

  async function handleDelete(id: number) {
    await deleteCampaign(id);
    if (selectedId === id) setSelectedId(null);
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

  const selectedCampaign = campaigns?.find((c) => c.id === selectedId) ?? null;
  const editingCampaign =
    editingId != null ? (campaigns?.find((c) => c.id === editingId) ?? null) : null;

  return (
    <div>
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

      <div className="lg:grid lg:grid-cols-[320px_1fr] lg:items-start lg:gap-6">
        {/* List column */}
        <div className={selectedId != null ? 'hidden lg:block' : 'block'}>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-parchment/50">
              {campaigns ? `${campaigns.length} campaigns` : ''}
            </p>
            <button
              type="button"
              onClick={openNewForm}
              className="min-h-11 rounded-md bg-ember px-3 py-2 text-sm font-semibold text-void transition-colors hover:bg-ember-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-bright"
            >
              + New
            </button>
          </div>

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
            <ul className="flex flex-col gap-2">
              {campaigns?.map((campaign) => {
                const activeSession = activeSessions[campaign.id];
                const isSelected = campaign.id === selectedId;
                return (
                  <li key={campaign.id}>
                    <button
                      type="button"
                      onClick={() => openCampaign(campaign.id)}
                      className={`w-full rounded-[10px] border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember ${
                        isSelected
                          ? 'border-ember/50 bg-ember/10'
                          : 'border-hairline/15 bg-nightshade/50 hover:bg-nightshade/70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="min-w-0 truncate font-display text-sm text-parchment">
                          {campaign.name}
                        </h2>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
                            activeSession
                              ? 'bg-emerald-400/15 text-emerald-300'
                              : 'bg-white/10 text-parchment/50'
                          }`}
                        >
                          {activeSession ? 'Active' : 'Idle'}
                        </span>
                      </div>
                      {campaign.description && (
                        <p className="mt-1 truncate text-xs text-parchment/50">
                          {campaign.description}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-1">{fearDots(campaign.fear)}</div>
                    </button>
                  </li>
                );
              })}
              {campaigns?.length === 0 && (
                <li className="rounded-[12px] border border-dashed border-hairline/25 p-6 text-center text-sm text-parchment/50">
                  No campaigns yet. Tap + New to create one.
                </li>
              )}
            </ul>
          )}
        </div>

        {/* Detail pane */}
        <div className={selectedId != null ? 'block' : 'hidden lg:block'}>
          {selectedCampaign ? (
            <CampaignDetailPane
              campaign={selectedCampaign}
              activeSession={activeSessions[selectedCampaign.id]}
              combatToolsEnabled={Boolean(settings.combat_tools_enabled)}
              playerAreaEnabled={Boolean(settings.player_area_enabled)}
              generatorsEnabled={Boolean(settings.generators_enabled)}
              onBack={closeDetail}
              onEdit={() => openEditForm(selectedCampaign.id)}
              onDelete={() => void handleDelete(selectedCampaign.id)}
              onStartSession={() => void handleStartSession(selectedCampaign.id)}
              onEndSession={() => {
                const session = activeSessions[selectedCampaign.id];
                if (session) void handleEndSession(selectedCampaign.id, session.id);
              }}
              onFearChange={(fear) => handleFearChange(selectedCampaign.id, fear)}
            />
          ) : (
            <div className="hidden min-h-[400px] items-center justify-center rounded-[14px] border border-dashed border-hairline/20 text-sm text-parchment/40 lg:flex">
              Select a campaign to see its details.
            </div>
          )}
        </div>
      </div>

      {/* New/Edit campaign modal */}
      {showFormModal && (
        <div
          onClick={closeForm}
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 lg:items-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-2xl border border-hairline/20 bg-nightshade p-5 lg:rounded-2xl lg:shadow-2xl"
          >
            <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-hairline/25 lg:hidden" />
            <h2 className="mb-4 font-display text-base text-parchment">
              {editingCampaign ? 'Edit campaign' : 'New campaign'}
            </h2>
            <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
              <input
                name="name"
                placeholder="Campaign name"
                defaultValue={editingCampaign?.name ?? ''}
                required
                className={inputClass}
              />
              <textarea
                name="description"
                placeholder="Description (optional)"
                defaultValue={editingCampaign?.description ?? ''}
                className={inputClass}
              />
              <div className="mt-1 flex gap-2">
                <button
                  type="submit"
                  className="min-h-11 flex-1 rounded-md bg-ember px-4 py-2 text-sm font-semibold text-void transition-colors hover:bg-ember-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-bright"
                >
                  {editingCampaign ? 'Save changes' : 'Create campaign'}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="min-h-11 rounded-md border border-hairline/20 px-4 py-2 text-sm text-parchment/70 transition-colors hover:bg-white/5 hover:text-parchment focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
