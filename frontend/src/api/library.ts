import { apiDelete, apiGet, apiPost, apiPut } from './client';

export interface World {
  id: number;
  name: string;
  created_at: string;
}

export interface LibraryEntity {
  id: number;
  name: string;
  summary: string;
  extra: string;
  kind?: string;
  world_id?: number;
  continent_id?: number;
  region_id?: number;
  created_at: string;
  updated_at: string;
}

// World > Continent > Region > Location is the place hierarchy; Faction/Npc/
// Adversary hang directly off World. Each segment's parent segment and
// whether it carries a free-text `kind` field mirrors the backend's shared
// CRUD factory (see backend/app/routers/library.py).
export type LibrarySegment =
  | 'continents'
  | 'regions'
  | 'locations'
  | 'factions'
  | 'npcs'
  | 'adversaries';

const PARENT_SEGMENT: Record<LibrarySegment, string> = {
  continents: 'worlds',
  regions: 'continents',
  locations: 'regions',
  factions: 'worlds',
  npcs: 'worlds',
  adversaries: 'worlds',
};

export const SEGMENT_HAS_KIND: Record<LibrarySegment, boolean> = {
  continents: true,
  regions: true,
  locations: true,
  factions: false,
  npcs: false,
  adversaries: false,
};

function collectionUrl(segment: LibrarySegment, parentId: number): string {
  return `/api/library/${PARENT_SEGMENT[segment]}/${parentId}/${segment}`;
}

export function listWorlds(): Promise<World[]> {
  return apiGet('/api/library/worlds');
}

export function createWorld(name: string): Promise<World> {
  return apiPost('/api/library/worlds', { name });
}

export function listEntities(segment: LibrarySegment, parentId: number): Promise<LibraryEntity[]> {
  return apiGet(collectionUrl(segment, parentId));
}

export function createEntity(
  segment: LibrarySegment,
  parentId: number,
  body: { name: string; summary?: string; extra?: string; kind?: string },
): Promise<LibraryEntity> {
  return apiPost(collectionUrl(segment, parentId), body);
}

export function updateEntity(
  segment: LibrarySegment,
  parentId: number,
  entityId: number,
  updates: Partial<Pick<LibraryEntity, 'name' | 'summary' | 'extra' | 'kind'>>,
): Promise<LibraryEntity> {
  return apiPut(`${collectionUrl(segment, parentId)}/${entityId}`, updates);
}

export function deleteEntity(
  segment: LibrarySegment,
  parentId: number,
  entityId: number,
): Promise<void> {
  return apiDelete(`${collectionUrl(segment, parentId)}/${entityId}`);
}
