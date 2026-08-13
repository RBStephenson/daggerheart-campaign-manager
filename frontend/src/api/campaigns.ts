import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './client';
import type { Character } from './player';

export interface Campaign {
  id: number;
  name: string;
  description: string;
  gm_user_id: number;
  created_at: string;
  fear: number;
}

export interface GameSession {
  id: number;
  campaign_id: number;
  status: 'active' | 'ended';
  room: string;
  started_at: string;
  ended_at: string | null;
}

export interface CampaignMember {
  id: number;
  campaign_id: number;
  player_user_id: number;
  player_username: string;
  joined_at: string;
}

export function listCampaigns(): Promise<Campaign[]> {
  return apiGet('/api/campaigns');
}

export function createCampaign(name: string, description: string): Promise<Campaign> {
  return apiPost('/api/campaigns', { name, description });
}

export function updateCampaign(
  id: number,
  updates: Partial<Pick<Campaign, 'name' | 'description'>>,
): Promise<Campaign> {
  return apiPut(`/api/campaigns/${id}`, updates);
}

export function deleteCampaign(id: number): Promise<void> {
  return apiDelete(`/api/campaigns/${id}`);
}

export function startSession(campaignId: number): Promise<GameSession> {
  return apiPost(`/api/campaigns/${campaignId}/sessions`);
}

export function endSession(campaignId: number, sessionId: number): Promise<GameSession> {
  return apiPost(`/api/campaigns/${campaignId}/sessions/${sessionId}/end`);
}

export function listSessions(campaignId: number): Promise<GameSession[]> {
  return apiGet(`/api/campaigns/${campaignId}/sessions`);
}

export function listMembers(campaignId: number): Promise<CampaignMember[]> {
  return apiGet(`/api/campaigns/${campaignId}/members`);
}

export function addMember(campaignId: number, username: string): Promise<CampaignMember> {
  return apiPost(`/api/campaigns/${campaignId}/members`, { username });
}

export function removeMember(campaignId: number, playerUserId: number): Promise<void> {
  return apiDelete(`/api/campaigns/${campaignId}/members/${playerUserId}`);
}

export function adjustFear(campaignId: number, delta: number): Promise<{ fear: number }> {
  return apiPatch(`/api/campaigns/${campaignId}/fear`, { delta });
}

export interface Countdown {
  id: number;
  campaign_id: number;
  name: string;
  starting_value: number;
  current_value: number;
  loop: boolean;
  triggered_at: string | null;
  created_at: string;
}

export function listCountdowns(campaignId: number): Promise<Countdown[]> {
  return apiGet(`/api/campaigns/${campaignId}/countdowns`);
}

export function createCountdown(
  campaignId: number,
  name: string,
  startingValue: number,
  loop: boolean,
): Promise<Countdown> {
  return apiPost(`/api/campaigns/${campaignId}/countdowns`, {
    name,
    starting_value: startingValue,
    loop,
  });
}

export function advanceCountdown(
  campaignId: number,
  countdownId: number,
  delta: number,
): Promise<Countdown> {
  return apiPatch(`/api/campaigns/${campaignId}/countdowns/${countdownId}`, { delta });
}

export function deleteCountdown(campaignId: number, countdownId: number): Promise<void> {
  return apiDelete(`/api/campaigns/${campaignId}/countdowns/${countdownId}`);
}

export interface PartyMember {
  player_username: string;
  character: Character;
}

export function getParty(campaignId: number): Promise<PartyMember[]> {
  return apiGet(`/api/campaigns/${campaignId}/party`);
}

export interface EncounterBudgetAdjustments {
  easier_fight: boolean;
  two_plus_solos: boolean;
  bonus_damage: boolean;
  lower_tier_adversary: boolean;
  no_bruiser_horde_leader_solo: boolean;
  harder_fight: boolean;
}

export interface EncounterBudget {
  party_size: number;
  budget: number;
}

// Battle Point cost per SRD adversary `type`, mirroring
// backend/app/services/encounter_budget.py's COST_BY_TYPE — kept in sync by
// hand since it's a small fixed SRD table, not worth a round trip per pick.
export const COST_BY_TYPE: Record<string, number> = {
  Minion: 1,
  Social: 1,
  Support: 1,
  Horde: 2,
  Ranged: 2,
  Skulk: 2,
  Standard: 2,
  Leader: 3,
  Bruiser: 4,
  Solo: 5,
};

export function getEncounterBudget(
  campaignId: number,
  adjustments: EncounterBudgetAdjustments,
): Promise<EncounterBudget> {
  const params = new URLSearchParams(
    Object.entries(adjustments).map(([key, value]) => [key, String(value)]),
  );
  return apiGet(`/api/campaigns/${campaignId}/encounter-budget?${params.toString()}`);
}
