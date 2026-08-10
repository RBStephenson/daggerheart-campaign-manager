import { useState } from 'react';
import { ApiError } from '../../api/client';
import { createInvite } from '../../api/auth';

const cardClass =
  'rounded-[12px] border border-hairline/15 bg-nightshade/60 p-5 backdrop-blur-sm';
const inputClass =
  'w-full rounded-md border border-hairline/20 bg-input-dark px-3 py-2 text-sm text-parchment placeholder:text-parchment/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember';

export default function InvitePlayerPanel() {
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setError(null);
    setCopied(false);
    setGenerating(true);
    try {
      const invite = await createInvite('player');
      setLink(`${window.location.origin}/register?token=${invite.token}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate invite link.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
  }

  return (
    <div className={`mb-6 max-w-md ${cardClass}`}>
      <h2 className="mb-1 font-display text-sm tracking-wide text-parchment/80">Invite a Player</h2>
      <p className="mb-3 text-xs text-parchment/50">
        Generate a one-time link for someone without a DHCM account yet. They'll pick their own
        username and password when they use it.
      </p>
      {error && <p className="mb-2 text-sm text-danger-text">{error}</p>}
      <button
        type="button"
        onClick={() => void handleGenerate()}
        disabled={generating}
        className="self-start rounded-md bg-ember px-4 py-2 text-sm font-semibold text-void transition-colors hover:bg-ember-bright disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-bright"
      >
        {generating ? 'Generating…' : 'Generate invite link'}
      </button>
      {link && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            readOnly
            value={link}
            aria-label="Invite link"
            onFocus={(e) => e.currentTarget.select()}
            className={`${inputClass} min-w-0 flex-1 font-mono text-xs`}
          />
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="shrink-0 rounded-md border border-hairline/20 px-3 py-2 text-sm text-parchment/70 hover:bg-white/5 hover:text-parchment"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  );
}
