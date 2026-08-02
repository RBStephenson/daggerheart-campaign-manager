import { apiDelete, apiGet, apiPost, apiPut } from './client';

export interface World {
  id: number;
  name: string;
  created_at: string;
}

export interface LibraryEntity {
  id: number;
  world_id: number;
  name: string;
  summary: string;
  extra: string;
  created_at: string;
  updated_at: string;
}

export type LibraryEntityType = 'regions' | 'factions' | 'npcs' | 'adversaries';

export function listWorlds(): Promise<World[]> {
  return apiGet('/api/library/worlds');
}

export function createWorld(name: string): Promise<World> {
  return apiPost('/api/library/worlds', { name });
}

export function listEntities(worldId: number, type: LibraryEntityType): Promise<LibraryEntity[]> {
  return apiGet(`/api/library/worlds/${worldId}/${type}`);
}

export function createEntity(
  worldId: number,
  type: LibraryEntityType,
  body: { name: string; summary?: string; extra?: string },
): Promise<LibraryEntity> {
  return apiPost(`/api/library/worlds/${worldId}/${type}`, body);
}

export function updateEntity(
  worldId: number,
  type: LibraryEntityType,
  entityId: number,
  updates: Partial<Pick<LibraryEntity, 'name' | 'summary' | 'extra'>>,
): Promise<LibraryEntity> {
  return apiPut(`/api/library/worlds/${worldId}/${type}/${entityId}`, updates);
}

export function deleteEntity(
  worldId: number,
  type: LibraryEntityType,
  entityId: number,
): Promise<void> {
  return apiDelete(`/api/library/worlds/${worldId}/${type}/${entityId}`);
}
