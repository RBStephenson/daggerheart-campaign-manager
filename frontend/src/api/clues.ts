import { apiDelete, apiGet, apiPost, apiPut } from './client';
import type { LibraryEntityType } from './sessionPlans';

export interface Clue {
  id: number;
  world_id: number;
  text: string;
  revelation: string;
  entity_type: LibraryEntityType | null;
  entity_id: number | null;
  created_at: string;
  updated_at: string;
}

function clueUrl(worldId: number, clueId?: number): string {
  const base = `/api/library/worlds/${worldId}/clues`;
  return clueId === undefined ? base : `${base}/${clueId}`;
}

export function listClues(worldId: number): Promise<Clue[]> {
  return apiGet(clueUrl(worldId));
}

export function createClue(
  worldId: number,
  body: {
    text: string;
    revelation?: string;
    entity_type?: LibraryEntityType | null;
    entity_id?: number | null;
  },
): Promise<Clue> {
  return apiPost(clueUrl(worldId), body);
}

export function updateClue(
  worldId: number,
  clueId: number,
  updates: Partial<Pick<Clue, 'text' | 'revelation' | 'entity_type' | 'entity_id'>>,
): Promise<Clue> {
  return apiPut(clueUrl(worldId, clueId), updates);
}

export function deleteClue(worldId: number, clueId: number): Promise<void> {
  return apiDelete(clueUrl(worldId, clueId));
}
