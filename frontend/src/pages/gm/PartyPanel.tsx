import { useEffect, useState } from 'react';
import Skeleton from '../../components/ui/Skeleton';
import { getParty, type PartyMember } from '../../api/campaigns';

const cardClass =
  'rounded-[12px] border border-hairline/15 bg-nightshade/60 p-5 backdrop-blur-sm';

interface ParsedSheet {
  hp_max: number;
  stress_max: number;
}

function parseSheet(extra: string): ParsedSheet | null {
  if (!extra) return null;
  try {
    const data = JSON.parse(extra) as Record<string, unknown>;
    if (typeof data.hp_max !== 'number' || typeof data.stress_max !== 'number') return null;
    return { hp_max: data.hp_max, stress_max: data.stress_max };
  } catch {
    return null;
  }
}

function StatText({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <span className="text-xs text-parchment/70">
      {label} <span className="font-mono text-parchment">{value} / {max}</span>
    </span>
  );
}

/** Read-only view of every campaign member's character sheet — the GM
 * previously had no visibility into player characters at all. */
export default function PartyPanel({ campaignId }: { campaignId: number }) {
  const [party, setParty] = useState<PartyMember[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getParty(campaignId)
      .then(setParty)
      .catch((err: unknown) => console.error(err))
      .finally(() => setLoading(false));
  }, [campaignId]);

  if (loading) {
    return (
      <ul className="flex flex-col gap-2" aria-label="Loading party">
        {[0, 1].map((i) => (
          <li key={i} className={cardClass}>
            <Skeleton className="h-5 w-1/3" />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {party?.map((member) => {
        const sheet = parseSheet(member.character.extra);
        return (
          <li
            key={member.character.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-hairline/15 bg-nightshade/60 px-4 py-2"
          >
            <div className="min-w-0">
              <span className="text-sm text-parchment">{member.character.name}</span>
              <span className="ml-2 text-xs text-parchment/50">
                {member.player_username}
                {member.character.char_class && ` · ${member.character.char_class}`}
              </span>
            </div>
            {sheet && (
              <div className="flex flex-wrap gap-3">
                <StatText label="HP" value={member.character.hp_marked} max={sheet.hp_max} />
                <StatText
                  label="Stress"
                  value={member.character.stress_marked}
                  max={sheet.stress_max}
                />
                <StatText label="Hope" value={member.character.hope} max={6} />
              </div>
            )}
          </li>
        );
      })}
      {party?.length === 0 && (
        <li className={`${cardClass} text-center text-sm text-parchment/50`}>
          No characters yet.
        </li>
      )}
    </ul>
  );
}
