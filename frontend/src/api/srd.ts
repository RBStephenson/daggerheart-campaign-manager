import { apiGet } from './client';

export interface SrdSubclass {
  name: string;
  spellcast_trait: string | null;
}

export interface SrdClass {
  name: string;
  domains: [string, string];
  starting_evasion: number;
  starting_hp: number;
  class_items: string[];
  subclasses: SrdSubclass[];
}

export interface SrdDomain {
  name: string;
  classes: string[];
}

export interface SrdDomainCard {
  domain: string;
  name: string;
  type: 'ability' | 'spell' | 'grimoire';
  recall_cost: number;
}

export interface SrdWeapon {
  name: string;
  trait: string;
  range: string;
  damage: string;
  burden: 'One-Handed' | 'Two-Handed';
  is_magic: boolean;
  feature: string | null;
}

export interface SrdArmor {
  name: string;
  base_thresholds: [number, number];
  base_score: number;
  feature: string | null;
}

export interface SrdCharacterCreationData {
  version: string;
  traits: string[];
  trait_array: number[];
  starting: { level: number; stress: number; hope: number; proficiency: number };
  classes: SrdClass[];
  ancestries: string[];
  communities: string[];
  domains: SrdDomain[];
  domain_cards_l1: SrdDomainCard[];
  weapons_tier1: SrdWeapon[];
  armor_tier1: SrdArmor[];
}

let cached: Promise<SrdCharacterCreationData> | null = null;

/** Fetch the SRD character-creation dataset once and cache it for the session. */
export function getCharacterCreationData(): Promise<SrdCharacterCreationData> {
  cached ??= apiGet<SrdCharacterCreationData>('/api/srd/character-creation');
  return cached;
}
