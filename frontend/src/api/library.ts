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
  // Adversary-only (DHCM-65/DHCM-90) -- a freeform GM note kept separate
  // from `extra`, which already carries the full spawned Bestiary stat
  // block for adversaries created via "Add to Library".
  notes?: string;
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
  | 'adversaries'
  | 'environments';

const PARENT_SEGMENT: Record<LibrarySegment, string> = {
  continents: 'worlds',
  regions: 'continents',
  locations: 'regions',
  factions: 'worlds',
  npcs: 'worlds',
  adversaries: 'worlds',
  environments: 'worlds',
};

export const SEGMENT_HAS_KIND: Record<LibrarySegment, boolean> = {
  continents: true,
  regions: true,
  locations: true,
  factions: false,
  npcs: false,
  adversaries: false,
  environments: false,
};

// Mirrors the backend's has_notes flag (library.py's _add_entity_routes) --
// only Adversary carries a notes field.
export const SEGMENT_HAS_NOTES: Record<LibrarySegment, boolean> = {
  continents: false,
  regions: false,
  locations: false,
  factions: false,
  npcs: false,
  adversaries: true,
  environments: false,
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
  body: { name: string; summary?: string; extra?: string; kind?: string; notes?: string },
): Promise<LibraryEntity> {
  return apiPost(collectionUrl(segment, parentId), body);
}

export function updateEntity(
  segment: LibrarySegment,
  parentId: number,
  entityId: number,
  updates: Partial<Pick<LibraryEntity, 'name' | 'summary' | 'extra' | 'kind' | 'notes'>>,
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
