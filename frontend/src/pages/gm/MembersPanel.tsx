import { useEffect, useState, type FormEvent } from 'react';
import Skeleton from '../../components/ui/Skeleton';
import { ApiError } from '../../api/client';
import { addMember, listMembers, removeMember, type CampaignMember } from '../../api/campaigns';

const cardClass =
  'rounded-[12px] border border-hairline/15 bg-nightshade/60 p-5 backdrop-blur-sm';
const inputClass =
  'w-full rounded-md border border-hairline/20 bg-input-dark px-3 py-2 text-sm text-parchment placeholder:text-parchment/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember';
const ghostButtonClass =
  'rounded-md border border-hairline/20 px-3 py-2 text-sm text-parchment/70 transition-colors hover:bg-white/5 hover:text-parchment focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember';

export default function MembersPanel({ campaignId }: { campaignId: number }) {
  const [members, setMembers] = useState<CampaignMember[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setMembers(await listMembers(campaignId));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const username = String(form.get('username') ?? '').trim();
    if (!username) return;
    try {
      await addMember(campaignId, username);
      formEl.reset();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add player.');
    }
  }

  async function handleRemove(playerUserId: number) {
    await removeMember(campaignId, playerUserId);
    await refresh();
  }

  return (
    <div>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-danger/50 bg-danger-bg/10 px-4 py-3 text-sm text-danger-text"
        >
          {error}
        </div>
      )}

      <form onSubmit={(e) => void handleAdd(e)} className={`mb-6 flex max-w-md flex-col gap-2 ${cardClass}`}>
        <h3 className="mb-1 font-display text-sm tracking-wide text-parchment/80">Invite Player</h3>
        <p className="mb-1 text-xs text-parchment/50">
          The player must already have a player account. Enter their username to add them to this
          campaign.
        </p>
        <input name="username" placeholder="Player username" required className={inputClass} />
        <button
          type="submit"
          className="self-start rounded-md bg-ember px-4 py-2 text-sm font-semibold text-void transition-colors hover:bg-ember-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-bright"
        >
          Add player
        </button>
      </form>

      {loading ? (
        <ul className="flex flex-col gap-2" aria-label="Loading members">
          {[0, 1].map((i) => (
            <li key={i} className={cardClass}>
              <Skeleton className="h-5 w-1/3" />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-2">
          {members?.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between gap-4 rounded-md border border-hairline/15 bg-nightshade/60 px-4 py-2"
            >
              <span className="text-sm text-parchment">{member.player_username}</span>
              <button
                type="button"
                onClick={() => void handleRemove(member.player_user_id)}
                className={ghostButtonClass}
              >
                Remove
              </button>
            </li>
          ))}
          {members?.length === 0 && (
            <li className="rounded-[12px] border border-dashed border-hairline/25 p-6 text-center text-sm text-parchment/50">
              No players added yet. Invite one above.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
