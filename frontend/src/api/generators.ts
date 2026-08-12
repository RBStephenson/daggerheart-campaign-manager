import { apiGet } from './client';

export type GeneratorKind = 'name' | 'npc' | 'loot';

export interface NameSuggestion {
  kind: 'name';
  name: string;
  ancestry: string | null;
}

export interface NpcSuggestion {
  kind: 'npc';
  name: string;
  role: string;
  motivation: string;
  quirk: string;
}

export interface LootSuggestion {
  kind: 'loot';
  name: string;
  description: string;
}

export type GeneratorSuggestion = NameSuggestion | NpcSuggestion | LootSuggestion;

export function generate(
  kind: GeneratorKind,
  param?: string | number,
): Promise<GeneratorSuggestion> {
  const query =
    kind === 'name' && typeof param === 'string'
      ? `?ancestry=${encodeURIComponent(param)}`
      : kind === 'loot' && typeof param === 'number'
        ? `?party_tier=${param}`
        : '';
  return apiGet(`/api/gm/generate/${kind}${query}`);
}
