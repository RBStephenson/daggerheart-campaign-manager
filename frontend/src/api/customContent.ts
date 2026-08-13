import { apiDelete, apiGet, apiPost, apiPut } from './client';

// The 7 custom entity types (DHCM-20/28), each global/instance-wide with no
// shared shape -- mirrors backend/app/routers/custom_content.py's segments.
export type CustomContentSegment =
  | 'classes'
  | 'ancestries'
  | 'communities'
  | 'domains'
  | 'domain-cards'
  | 'weapons'
  | 'armor';

export type CustomFieldType = 'text' | 'number' | 'boolean' | 'textarea';

export interface CustomFieldConfig {
  name: string;
  label: string;
  type: CustomFieldType;
  required?: boolean;
  defaultValue?: string;
}

export const SEGMENT_LABELS: Record<CustomContentSegment, string> = {
  classes: 'Classes',
  ancestries: 'Ancestries',
  communities: 'Communities',
  domains: 'Domains',
  'domain-cards': 'Domain Cards',
  weapons: 'Weapons',
  armor: 'Armor',
};

// Armor has no plural to strip ("Armor", not "Armors"), so a shared regex
// can't derive these from SEGMENT_LABELS -- spelled out explicitly instead.
export const SEGMENT_SINGULAR_LABELS: Record<CustomContentSegment, string> = {
  classes: 'Class',
  ancestries: 'Ancestry',
  communities: 'Community',
  domains: 'Domain',
  'domain-cards': 'Domain Card',
  weapons: 'Weapon',
  armor: 'Armor',
};

// Field order/type per segment, matching each Create schema in
// backend/app/schemas/custom_content.py 1:1 -- drives the generic form
// instead of hand-building 7 bespoke ones.
export const SEGMENT_FIELDS: Record<CustomContentSegment, CustomFieldConfig[]> = {
  classes: [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'domains_json', label: 'Domains (JSON list)', type: 'textarea', required: true },
    { name: 'starting_evasion', label: 'Starting Evasion', type: 'number', required: true },
    { name: 'starting_hp', label: 'Starting HP', type: 'number', required: true },
    { name: 'class_items_json', label: 'Class Items (JSON list)', type: 'textarea', required: true },
    { name: 'subclasses_json', label: 'Subclasses (JSON list)', type: 'textarea', required: true },
  ],
  ancestries: [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'features_json', label: 'Features (JSON list)', type: 'textarea', defaultValue: '[]' },
  ],
  communities: [
    { name: 'name', label: 'Name', type: 'text', required: true },
    {
      name: 'adjectives_json',
      label: 'Adjectives (JSON list)',
      type: 'textarea',
      defaultValue: '[]',
    },
    {
      name: 'feature_json',
      label: 'Feature (JSON object or null)',
      type: 'textarea',
      defaultValue: 'null',
    },
  ],
  domains: [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'classes_json', label: 'Classes (JSON list)', type: 'textarea', required: true },
  ],
  'domain-cards': [
    { name: 'domain', label: 'Domain', type: 'text', required: true },
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'type', label: 'Type', type: 'text', required: true },
    { name: 'recall_cost', label: 'Recall Cost', type: 'number', required: true },
  ],
  weapons: [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'trait', label: 'Trait', type: 'text', required: true },
    { name: 'range', label: 'Range', type: 'text', required: true },
    { name: 'damage', label: 'Damage', type: 'text', required: true },
    { name: 'burden', label: 'Burden', type: 'text', required: true },
    { name: 'is_magic', label: 'Magic', type: 'boolean' },
    { name: 'feature', label: 'Feature (optional)', type: 'textarea' },
  ],
  armor: [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'threshold_low', label: 'Threshold (Low)', type: 'number', required: true },
    { name: 'threshold_high', label: 'Threshold (High)', type: 'number', required: true },
    { name: 'base_score', label: 'Base Score', type: 'number', required: true },
    { name: 'feature', label: 'Feature (optional)', type: 'textarea' },
  ],
};

export interface CustomEntity {
  id: number;
  name: string;
  created_at: string;
  [key: string]: unknown;
}

function url(segment: CustomContentSegment, entityId?: number): string {
  const base = `/api/custom-content/${segment}`;
  return entityId === undefined ? base : `${base}/${entityId}`;
}

export function listCustomEntities(segment: CustomContentSegment): Promise<CustomEntity[]> {
  return apiGet(url(segment));
}

export function createCustomEntity(
  segment: CustomContentSegment,
  body: Record<string, unknown>,
): Promise<CustomEntity> {
  return apiPost(url(segment), body);
}

export function updateCustomEntity(
  segment: CustomContentSegment,
  entityId: number,
  body: Record<string, unknown>,
): Promise<CustomEntity> {
  return apiPut(url(segment, entityId), body);
}

export function deleteCustomEntity(
  segment: CustomContentSegment,
  entityId: number,
): Promise<void> {
  return apiDelete(url(segment, entityId));
}
