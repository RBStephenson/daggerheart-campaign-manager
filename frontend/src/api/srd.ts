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

export interface SrdFeature {
  name: string;
  text: string;
}

export interface SrdAncestry {
  name: string;
  features: SrdFeature[];
}

export interface SrdCommunity {
  name: string;
  adjectives: string[];
  feature: SrdFeature;
}

export interface SrdDomain {
  name: string;
  classes: string[];
}

export interface SrdDomainCard {
  domain: string;
  level: number;
  name: string;
  type: 'ability' | 'spell' | 'grimoire';
  recall_cost: number;
  text: string;
}

export interface SrdPrimaryWeapon {
  tier: number;
  name: string;
  trait: string;
  range: string;
  damage: string;
  burden: 'One-Handed' | 'Two-Handed';
  is_magic: boolean;
  feature: string | null;
}

export interface SrdSecondaryWeapon {
  tier: number;
  name: string;
  trait: string;
  range: string;
  damage: string;
  burden: 'One-Handed';
  feature: string | null;
}

export interface SrdArmor {
  tier: number;
  name: string;
  base_thresholds: [number, number];
  base_score: number;
  feature: string | null;
}

export interface SrdCombatWheelchair {
  tier: number;
  name: string;
  trait: string;
  range: string;
  damage: string;
  burden: 'One-Handed' | 'Two-Handed';
  feature: string | null;
}

export interface SrdCharacterCreationData {
  version: string;
  traits: string[];
  trait_array: number[];
  starting: { level: number; stress: number; hope: number; proficiency: number };
  classes: SrdClass[];
  ancestries: SrdAncestry[];
  communities: SrdCommunity[];
  domains: SrdDomain[];
  domain_cards: SrdDomainCard[];
  primary_weapons: SrdPrimaryWeapon[];
  secondary_weapons: SrdSecondaryWeapon[];
  armor: SrdArmor[];
  combat_wheelchair: SrdCombatWheelchair[];
}

let cached: Promise<SrdCharacterCreationData> | null = null;

/** Fetch the SRD character-creation dataset once and cache it for the session. */
export function getCharacterCreationData(): Promise<SrdCharacterCreationData> {
  cached ??= apiGet<SrdCharacterCreationData>('/api/srd/character-creation');
  return cached;
}
