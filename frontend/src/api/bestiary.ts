import { apiGet } from './client';

export interface StatBlockFeature {
  name: string;
  kind: 'action' | 'reaction' | 'passive';
  text: string;
  tag?: string;
  questions?: string;
}

export interface Adversary {
  name: string;
  tier: number;
  type: string;
  horde_hp_per_rank: number | null;
  description: string;
  motives_and_tactics: string;
  difficulty: number;
  threshold_major: number | null;
  threshold_severe: number | null;
  hp: number;
  stress: number;
  attack_modifier: string;
  standard_attack_name: string;
  standard_attack_range: string;
  standard_attack_damage: string;
  experience: string | null;
  features: StatBlockFeature[];
}

export interface Environment {
  name: string;
  tier: number;
  type: string;
  description: string;
  impulses: string;
  difficulty: number | null;
  potential_adversaries: string | null;
  features: StatBlockFeature[];
}

export interface BestiaryDataset {
  adversaries: Adversary[];
  environments: Environment[];
}

export function getBestiary(): Promise<BestiaryDataset> {
  return apiGet('/api/bestiary/');
}
