import { apiGet, apiPost, apiPut, apiDelete } from './client';

export interface MemberCampaign {
  id: number;
  name: string;
  description: string;
  gm_user_id: number;
  created_at: string;
}

export interface Character {
  id: number;
  player_user_id: number;
  campaign_id: number;
  name: string;
  char_class: string;
  ancestry: string;
  community: string;
  level: number;
  extra: string;
  created_at: string;
}

export interface Note {
  campaign_id: number;
  body: string;
  updated_at: string;
}

export function listMyCampaigns(): Promise<MemberCampaign[]> {
  return apiGet('/api/player/campaigns');
}

export function listMyCharacters(campaignId?: number): Promise<Character[]> {
  const query = campaignId !== undefined ? `?campaign_id=${campaignId}` : '';
  return apiGet(`/api/player/characters${query}`);
}

export function createCharacter(input: {
  campaign_id: number;
  name: string;
  char_class: string;
  ancestry: string;
  community: string;
  level: number;
}): Promise<Character> {
  return apiPost('/api/player/characters', input);
}

export function updateCharacter(
  id: number,
  updates: Partial<Pick<Character, 'name' | 'char_class' | 'ancestry' | 'community' | 'level'>>,
): Promise<Character> {
  return apiPut(`/api/player/characters/${id}`, updates);
}

export function deleteCharacter(id: number): Promise<void> {
  return apiDelete(`/api/player/characters/${id}`);
}

export function getNote(campaignId: number): Promise<Note> {
  return apiGet(`/api/player/campaigns/${campaignId}/note`);
}

export function saveNote(campaignId: number, body: string): Promise<Note> {
  return apiPut(`/api/player/campaigns/${campaignId}/note`, { body });
}
