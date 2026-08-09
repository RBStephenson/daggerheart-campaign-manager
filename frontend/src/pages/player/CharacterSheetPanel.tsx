import { useMemo } from 'react';
import { updateCharacterState, type Character } from '../../api/player';
import type { SrdArmor } from '../../api/srd';

interface ParsedSheet {
  hp_max: number;
  stress_max: number;
  armor_name: string;
}

function parseSheet(extra: string): ParsedSheet | null {
  if (!extra) return null;
  try {
    const data = JSON.parse(extra) as Record<string, unknown>;
    if (
      typeof data.hp_max !== 'number' ||
      typeof data.stress_max !== 'number' ||
      typeof data.equipment !== 'object' ||
      data.equipment === null
    ) {
      return null;
    }
    const equipment = data.equipment as Record<string, unknown>;
    if (typeof equipment.armor !== 'string') return null;
    return { hp_max: data.hp_max, stress_max: data.stress_max, armor_name: equipment.armor };
  } catch {
    return null;
  }
}

interface TrackerRowProps {
  label: string;
  value: number;
  max: number;
  onChange: (next: number) => void;
}

function TrackerRow({ label, value, max, onChange }: TrackerRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-parchment/70">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Clear a ${label}`}
          disabled={value <= 0}
          onClick={() => onChange(value - 1)}
          className="h-6 w-6 rounded border border-hairline/20 text-parchment/70 hover:bg-white/5 disabled:opacity-30"
        >
          −
        </button>
        <span className="w-12 text-center font-mono text-parchment">
          {value} / {max}
        </span>
        <button
          type="button"
          aria-label={`Mark a ${label}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          className="h-6 w-6 rounded border border-hairline/20 text-parchment/70 hover:bg-white/5 disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}

interface CharacterSheetPanelProps {
  character: Character;
  armorByName: Record<string, SrdArmor>;
  onUpdated: (updated: Character) => void;
}

export default function CharacterSheetPanel({
  character,
  armorByName,
  onUpdated,
}: CharacterSheetPanelProps) {
  const sheet = useMemo(() => parseSheet(character.extra), [character.extra]);
  if (!sheet) return null;

  const armorScore = armorByName[sheet.armor_name]?.base_score ?? 0;

  async function patch(field: 'hp_marked' | 'stress_marked' | 'hope' | 'armor_slots_marked', value: number) {
    const updated = await updateCharacterState(character.id, { [field]: value });
    onUpdated(updated);
  }

  return (
    <div className="mt-3 flex flex-col gap-1.5 border-t border-hairline/10 pt-3">
      <TrackerRow
        label="HP"
        value={character.hp_marked}
        max={sheet.hp_max}
        onChange={(v) => void patch('hp_marked', v)}
      />
      <TrackerRow
        label="Stress"
        value={character.stress_marked}
        max={sheet.stress_max}
        onChange={(v) => void patch('stress_marked', v)}
      />
      <TrackerRow
        label="Hope"
        value={character.hope}
        max={6}
        onChange={(v) => void patch('hope', v)}
      />
      {armorScore > 0 && (
        <TrackerRow
          label="Armor Slots"
          value={character.armor_slots_marked}
          max={armorScore}
          onChange={(v) => void patch('armor_slots_marked', v)}
        />
      )}
    </div>
  );
}
