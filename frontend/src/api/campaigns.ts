import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './client';

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
