import { apiDelete, apiGet, apiPost, apiPut } from './client';

export interface Campaign {
  id: number;
  name: string;
  description: string;
  gm_user_id: number;
  created_at: string;
}

export interface GameSession {
  id: number;
  campaign_id: number;
  status: 'active' | 'ended';
  room: string;
  started_at: string;
  ended_at: string | null;
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
