import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from './client';

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
  hp_marked: number;
  stress_marked: number;
  hope: number;
  armor_slots_marked: number;
  created_at: string;
}

export interface CharacterState {
  hp_marked?: number;
  stress_marked?: number;
  hope?: number;
  armor_slots_marked?: number;
}

export interface Note {
  campaign_id: number;
  body: string;
  updated_at: string;
}

export type RestType = 'short' | 'long';
export type RestMove = 'tend_wounds' | 'clear_stress' | 'repair_armor' | 'prepare';

export interface RestResult {
  field: 'hp_marked' | 'stress_marked' | 'armor_slots_marked' | 'hope';
  roll: number | null;
  tier: number | null;
  amount: number;
  new_value: number;
}

export interface RestResponse {
  character: Character;
  result: RestResult;
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
  extra?: string;
}): Promise<Character> {
  return apiPost('/api/player/characters', input);
}

export function updateCharacter(
  id: number,
  updates: Partial<
    Pick<Character, 'name' | 'char_class' | 'ancestry' | 'community' | 'level' | 'extra'>
  >,
): Promise<Character> {
  return apiPut(`/api/player/characters/${id}`, updates);
}

export function deleteCharacter(id: number): Promise<void> {
  return apiDelete(`/api/player/characters/${id}`);
}

export function updateCharacterState(id: number, state: CharacterState): Promise<Character> {
  return apiPatch(`/api/player/characters/${id}/state`, state);
}

export function restCharacter(
  id: number,
  rest_type: RestType,
  move: RestMove,
): Promise<RestResponse> {
  return apiPost(`/api/player/characters/${id}/rest`, { rest_type, move });
}

export function checkDowntimeAvailable(): Promise<{ available: boolean }> {
  return apiGet('/api/player/downtime');
}

export function getNote(campaignId: number): Promise<Note> {
  return apiGet(`/api/player/campaigns/${campaignId}/note`);
}

export function saveNote(campaignId: number, body: string): Promise<Note> {
  return apiPut(`/api/player/campaigns/${campaignId}/note`, { body });
}
