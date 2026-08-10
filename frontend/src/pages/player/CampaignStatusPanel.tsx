import { useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { getCampaignFear, listCampaignCountdowns } from '../../api/player';
import type { Countdown } from '../../api/campaigns';
import { useWebSocket, type Envelope } from '../../hooks/useWebSocket';

/** Read-only view of the shared Fear pool and active countdowns for a
 * campaign — players previously had no visibility into either. Probes via
 * the endpoints themselves (same invisible-rather-than-erroring pattern
 * used everywhere else in the player area, since /api/settings is gm-only).
 * When a session is active, updates live as the GM adjusts Fear/countdowns. */
export default function CampaignStatusPanel({
  campaignId,
  room = null,
}: {
  campaignId: number;
  room?: string | null;
}) {
  const [available, setAvailable] = useState(true);
  const [fear, setFear] = useState<number | null>(null);
  const [countdowns, setCountdowns] = useState<Countdown[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getCampaignFear(campaignId), listCampaignCountdowns(campaignId)])
      .then(([fearResult, countdownList]) => {
        if (cancelled) return;
        setAvailable(true);
        setFear(fearResult.fear);
        setCountdowns(countdownList);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) setAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  useWebSocket(room, {
    onMessage: (envelope: Envelope) => {
      if (envelope.type === 'fear') {
        setFear((envelope.payload as unknown as { fear: number }).fear);
        return;
      }
      if (envelope.type === 'countdown_created') {
        const created = envelope.payload as unknown as Countdown;
        setCountdowns((prev) => [...prev, created]);
        return;
      }
      if (envelope.type === 'countdown_updated') {
        const updated = envelope.payload as unknown as Countdown;
        setCountdowns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        return;
      }
      if (envelope.type === 'countdown_deleted') {
        const { id } = envelope.payload as unknown as { id: number };
        setCountdowns((prev) => prev.filter((c) => c.id !== id));
      }
    },
  });

  if (!available) return null;

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-hairline/10 pt-3 text-sm">
      {fear !== null && (
        <p className="text-parchment/70">
          Fear <span className="font-mono text-parchment">{fear} / 12</span>
        </p>
      )}
      {countdowns.length > 0 && (
        <ul className="flex flex-col gap-1">
          {countdowns.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 text-parchment/70">
              <span>
                {c.name}
                {c.loop && <span className="ml-1 text-xs text-parchment/50">(loop)</span>}
              </span>
              <span className="font-mono text-parchment">
                {c.current_value} / {c.starting_value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
