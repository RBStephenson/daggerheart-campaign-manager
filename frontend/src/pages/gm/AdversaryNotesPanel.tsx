import { useEffect, useMemo, useState } from 'react';
import Skeleton from '../../components/ui/Skeleton';
import { listEntities, listWorlds, type LibraryEntity } from '../../api/library';

const cardClass =
  'rounded-[12px] border border-hairline/15 bg-nightshade/60 p-5 backdrop-blur-sm';
const inputClass =
  'w-full rounded-md border border-hairline/20 bg-input-dark px-3 py-2 text-sm text-parchment placeholder:text-parchment/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember';

/** Read-only quick-recall view of the world's Adversaries and their GM
 * notes (DHCM-65/DHCM-90/-91) -- for mid-session recall of signature moves
 * and table reminders, not authoring. Notes are written from the Library's
 * Adversary tab; this panel just surfaces them during live play. Adversaries
 * are world-scoped, not campaign-scoped (Campaign has no world_id), so this
 * reads the GM's one world the same way SessionPlansPanel's link picker
 * does, rather than taking a campaignId. */
export default function AdversaryNotesPanel() {
  const [adversaries, setAdversaries] = useState<LibraryEntity[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    listWorlds()
      .then((worlds) => {
        const worldId = worlds[0]?.id;
        if (worldId === undefined) return [];
        return listEntities('adversaries', worldId);
      })
      .then(setAdversaries)
      .catch((err: unknown) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!adversaries) return [];
    const q = query.trim().toLowerCase();
    if (!q) return adversaries;
    return adversaries.filter((a) => a.name.toLowerCase().includes(q));
  }, [adversaries, query]);

  if (loading) {
    return (
      <ul className="flex flex-col gap-2" aria-label="Loading adversary notes">
        {[0, 1].map((i) => (
          <li key={i} className={cardClass}>
            <Skeleton className="h-5 w-1/3" />
          </li>
        ))}
      </ul>
    );
  }

  if (adversaries?.length === 0) {
    return (
      <p className={`${cardClass} text-center text-sm text-parchment/50`}>
        No adversaries in your Library yet. Add some from the Library tab or the Bestiary.
      </p>
    );
  }

  return (
    <div>
      <input
        type="search"
        placeholder="Search adversaries..."
        aria-label="Search adversaries"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={`mb-3 max-w-xs ${inputClass}`}
      />
      <ul className="flex flex-col gap-2">
        {filtered.map((adversary) => (
          <li key={adversary.id} className={cardClass}>
            <span className="text-sm text-parchment">{adversary.name}</span>
            {adversary.notes ? (
              <p className="mt-1 break-words text-sm text-parchment/60">{adversary.notes}</p>
            ) : (
              <p className="mt-1 text-xs text-parchment/30">No GM notes yet.</p>
            )}
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="text-center text-sm text-parchment/50">No adversaries match "{query}".</li>
        )}
      </ul>
    </div>
  );
}
