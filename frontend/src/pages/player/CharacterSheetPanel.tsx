import { useState, useMemo } from 'react';
import {
  restCharacter,
  updateCharacterState,
  type Character,
  type RestMove,
  type RestResult,
  type RestType,
} from '../../api/player';
import type { SrdArmor } from '../../api/srd';

const REST_MOVES: { move: RestMove; label: string }[] = [
  { move: 'tend_wounds', label: 'Tend to Wounds' },
  { move: 'clear_stress', label: 'Clear Stress' },
  { move: 'repair_armor', label: 'Repair Armor' },
  { move: 'prepare', label: 'Prepare' },
];

function describeResult(result: RestResult): string {
  const noun =
    result.field === 'hp_marked'
      ? 'HP'
      : result.field === 'stress_marked'
        ? 'Stress'
        : result.field === 'armor_slots_marked'
          ? 'Armor Slot'
          : 'Hope';
  if (result.field === 'hope') return `Gained ${result.amount} Hope.`;
  if (result.roll === null) return `Cleared all ${result.amount} marked ${noun}.`;
  return `Rolled ${result.roll} + Tier ${result.tier} — cleared ${result.amount} ${noun}.`;
}

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
  downtimeAvailable: boolean;
  onUpdated: (updated: Character) => void;
}

export default function CharacterSheetPanel({
  character,
  armorByName,
  downtimeAvailable,
  onUpdated,
}: CharacterSheetPanelProps) {
  const [restType, setRestType] = useState<RestType>('short');
  const [restBusy, setRestBusy] = useState(false);
  const [restMessage, setRestMessage] = useState<string | null>(null);
  const sheet = useMemo(() => parseSheet(character.extra), [character.extra]);
  if (!sheet) return null;

  const armorScore = armorByName[sheet.armor_name]?.base_score ?? 0;

  async function patch(field: 'hp_marked' | 'stress_marked' | 'hope' | 'armor_slots_marked', value: number) {
    const updated = await updateCharacterState(character.id, { [field]: value });
    onUpdated(updated);
  }

  async function rest(move: RestMove) {
    setRestBusy(true);
    setRestMessage(null);
    try {
      const { character: updated, result } = await restCharacter(character.id, restType, move);
      onUpdated(updated);
      setRestMessage(describeResult(result));
    } finally {
      setRestBusy(false);
    }
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
      {downtimeAvailable && (
        <div className="mt-2 flex flex-col gap-1.5 border-t border-hairline/10 pt-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-parchment/70">Rest</span>
            <select
              aria-label="Rest type"
              value={restType}
              onChange={(e) => setRestType(e.target.value as RestType)}
              className="rounded border border-hairline/20 bg-input-dark px-2 py-1 text-xs text-parchment focus:outline-none focus-visible:ring-2 focus-visible:ring-ember"
            >
              <option value="short">Short Rest</option>
              <option value="long">Long Rest</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {REST_MOVES.map(({ move, label }) => (
              <button
                key={move}
                type="button"
                disabled={restBusy}
                onClick={() => void rest(move)}
                className="rounded border border-hairline/20 px-2 py-1 text-xs text-parchment/70 hover:bg-white/5 disabled:opacity-30"
              >
                {label}
              </button>
            ))}
          </div>
          {restMessage && <p className="text-xs text-parchment/60">{restMessage}</p>}
        </div>
      )}
    </div>
  );
}
