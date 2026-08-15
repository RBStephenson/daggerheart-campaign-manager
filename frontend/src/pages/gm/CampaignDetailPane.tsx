import { useEffect, useState } from 'react';
import Badge from '../../components/ui/Badge';
import ChatPanel from '../../components/ChatPanel';
import AdversaryNotesPanel from './AdversaryNotesPanel';
import CountdownsPanel from './CountdownsPanel';
import EncounterBuilderPanel from './EncounterBuilderPanel';
import FearTracker from './FearTracker';
import MembersPanel from './MembersPanel';
import PartyPanel from './PartyPanel';
import QuickGeneratePanel from './QuickGeneratePanel';
import SessionPlansPanel from './SessionPlansPanel';
import type { Campaign, GameSession } from '../../api/campaigns';

type DetailTab =
  | 'overview'
  | 'party'
  | 'plans'
  | 'members'
  | 'countdowns'
  | 'adversaries'
  | 'encounter'
  | 'generate';

const TAB_LABELS: Record<DetailTab, string> = {
  overview: 'Overview',
  party: 'Party',
  plans: 'Plans',
  members: 'Members',
  countdowns: 'Countdowns',
  adversaries: 'Adversaries',
  encounter: 'Encounter',
  generate: 'Generate',
};

const ghostButtonClass =
  'rounded-md border border-hairline/20 px-3 py-2 text-sm text-parchment/70 transition-colors hover:bg-white/5 hover:text-parchment focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember';
const dangerButtonClass =
  'rounded-md border border-danger/50 px-3 py-2 text-sm text-danger-text transition-colors hover:bg-danger-bg/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-danger';

function pillClass(active: boolean) {
  return `min-h-11 flex-none whitespace-nowrap rounded-full border px-3.5 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember ${
    active
      ? 'border-ember/50 bg-ember/15 text-ember-bright'
      : 'border-hairline/15 text-parchment/60 hover:bg-white/5 hover:text-parchment'
  }`;
}

interface CampaignDetailPaneProps {
  campaign: Campaign;
  activeSession: GameSession | undefined;
  combatToolsEnabled: boolean;
  playerAreaEnabled: boolean;
  generatorsEnabled: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStartSession: () => void;
  onEndSession: () => void;
  onFearChange: (fear: number) => void;
}

export default function CampaignDetailPane({
  campaign,
  activeSession,
  combatToolsEnabled,
  playerAreaEnabled,
  generatorsEnabled,
  onBack,
  onEdit,
  onDelete,
  onStartSession,
  onEndSession,
  onFearChange,
}: CampaignDetailPaneProps) {
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');

  useEffect(() => {
    setDetailTab('overview');
  }, [campaign.id]);

  const tabs: DetailTab[] = [
    'overview',
    ...(playerAreaEnabled ? (['party'] as const) : []),
    'plans',
    'members',
    ...(combatToolsEnabled ? (['countdowns', 'adversaries', 'encounter'] as const) : []),
    ...(generatorsEnabled ? (['generate'] as const) : []),
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:min-h-[560px] lg:rounded-[14px] lg:border lg:border-hairline/15 lg:bg-nightshade/40 lg:p-6">
      {/* Header */}
      <div className="mb-4 flex items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to campaigns"
          className={`${ghostButtonClass} min-h-11 shrink-0 px-3 lg:hidden`}
        >
          ‹
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="break-words font-display text-lg text-parchment lg:text-xl">
            {campaign.name}
          </h2>
          {campaign.description && (
            <p className="mt-1 max-w-xl break-words text-sm text-parchment/60">
              {campaign.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={onEdit} className={`${ghostButtonClass} min-h-11`}>
            Edit
          </button>
          <button type="button" onClick={onDelete} className={`${dangerButtonClass} min-h-11`}>
            Delete
          </button>
        </div>
      </div>

      {/* Session bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-hairline/10 bg-white/[0.03] px-4 py-3">
        <Badge variant={activeSession ? 'success' : 'neutral'}>
          {activeSession ? 'Session active' : 'No active session'}
        </Badge>
        {combatToolsEnabled && (
          <FearTracker campaignId={campaign.id} fear={campaign.fear} onChange={onFearChange} />
        )}
        {activeSession ? (
          <button
            type="button"
            onClick={onEndSession}
            className={`${dangerButtonClass} min-h-11`}
          >
            End session
          </button>
        ) : (
          <button
            type="button"
            onClick={onStartSession}
            className="min-h-11 rounded-md bg-ember px-4 py-2 text-sm font-semibold text-void transition-colors hover:bg-ember-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-bright"
          >
            Start session
          </button>
        )}
      </div>

      {activeSession && <ChatPanel room={activeSession.room} />}

      {/* Sub-nav pills */}
      <div className="-mx-4 mt-4 mb-4 flex gap-2 overflow-x-auto border-b border-hairline/10 px-4 pb-3 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:border-b-0 lg:px-0 lg:pb-0">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setDetailTab(tab)}
            className={pillClass(detailTab === tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        {detailTab === 'overview' && (
          <div>
            <p className="mb-2 text-sm text-parchment/60">
              {campaign.description || 'No description.'}
            </p>
            <p className="text-xs text-parchment/35">
              Session room: {activeSession?.room ?? '—'}
            </p>
          </div>
        )}
        {detailTab === 'party' && (
          <PartyPanel campaignId={campaign.id} room={activeSession?.room ?? null} />
        )}
        {detailTab === 'plans' && <SessionPlansPanel campaignId={campaign.id} />}
        {detailTab === 'members' && <MembersPanel campaignId={campaign.id} />}
        {detailTab === 'countdowns' && <CountdownsPanel campaignId={campaign.id} />}
        {detailTab === 'adversaries' && <AdversaryNotesPanel />}
        {detailTab === 'encounter' && <EncounterBuilderPanel campaignId={campaign.id} />}
        {detailTab === 'generate' && <QuickGeneratePanel />}
      </div>
    </div>
  );
}
