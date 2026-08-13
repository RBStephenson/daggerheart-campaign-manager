import { useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { generate, type GeneratorKind, type GeneratorSuggestion } from '../../api/generators';
import { createEntity, listWorlds, type World } from '../../api/library';

const cardClass =
  'rounded-[12px] border border-hairline/15 bg-nightshade/60 p-5 backdrop-blur-sm';
const ghostButtonClass =
  'rounded-md border border-hairline/20 px-3 py-2 text-sm text-parchment/70 transition-colors hover:bg-white/5 hover:text-parchment focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember';
const primaryButtonClass =
  'rounded-md bg-ember px-3 py-2 text-sm font-semibold text-void transition-colors hover:bg-ember-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-bright';

const LABELS: Record<GeneratorKind, string> = {
  name: 'Name',
  npc: 'NPC',
  loot: 'Loot',
};

function SuggestionCard({ suggestion }: { suggestion: GeneratorSuggestion }) {
  if (suggestion.kind === 'name') {
    return (
      <div>
        <p className="text-sm text-parchment">{suggestion.name}</p>
        {suggestion.ancestry && (
          <p className="text-xs text-parchment/50">{suggestion.ancestry}</p>
        )}
      </div>
    );
  }
  if (suggestion.kind === 'npc') {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-sm text-parchment">
          <span data-testid="quick-generate-npc-name">{suggestion.name}</span> —{' '}
          <span className="text-parchment/70">{suggestion.role}</span>
        </p>
        <p className="text-xs text-parchment/60">Motivation: {suggestion.motivation}</p>
        <p className="text-xs text-parchment/60">Quirk: {suggestion.quirk}</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-sm text-parchment">{suggestion.name}</p>
      <p className="text-xs text-parchment/60">{suggestion.description}</p>
    </div>
  );
}

export default function QuickGeneratePanel() {
  const [active, setActive] = useState<GeneratorKind | null>(null);
  const [suggestion, setSuggestion] = useState<GeneratorSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [world, setWorld] = useState<World | null>(null);
  const [keeping, setKeeping] = useState(false);
  const [kept, setKept] = useState(false);

  useEffect(() => {
    listWorlds()
      .then((worlds) => setWorld(worlds[0] ?? null))
      .catch(() => {
        // Library might be disabled independently of generators — Keep is
        // an optional enhancement, not a hard requirement for generating.
      });
  }, []);

  async function handleGenerate(kind: GeneratorKind) {
    setError(null);
    setActive(kind);
    setKept(false);
    try {
      const result = await generate(kind);
      setSuggestion(result);
    } catch (err) {
      setSuggestion(null);
      setError(err instanceof ApiError ? err.message : 'Failed to generate a suggestion.');
    }
  }

  function handleDismiss() {
    setActive(null);
    setSuggestion(null);
    setError(null);
    setKept(false);
  }

  async function handleKeep() {
    if (!world || !suggestion || suggestion.kind !== 'npc') return;
    setKeeping(true);
    try {
      await createEntity('npcs', world.id, {
        name: suggestion.name,
        summary: `${suggestion.role}. Motivation: ${suggestion.motivation}. Quirk: ${suggestion.quirk}`,
        extra: JSON.stringify(suggestion),
      });
      setKept(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save to Library.');
    } finally {
      setKeeping(false);
    }
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

      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(LABELS) as GeneratorKind[]).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => void handleGenerate(kind)}
            className={primaryButtonClass}
          >
            Generate {LABELS[kind]}
          </button>
        ))}
      </div>

      {active && suggestion && (
        <div className={cardClass}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm tracking-wide text-parchment/80">
              {LABELS[active]}
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleGenerate(active)}
                className={ghostButtonClass}
              >
                Reroll
              </button>
              <button type="button" onClick={handleDismiss} className={ghostButtonClass}>
                Dismiss
              </button>
            </div>
          </div>
          <SuggestionCard suggestion={suggestion} />
          {suggestion.kind === 'npc' && (
            <div className="mt-4">
              {world ? (
                <button
                  type="button"
                  onClick={() => void handleKeep()}
                  disabled={keeping || kept}
                  className="rounded-md bg-ember px-3 py-2 text-sm font-semibold text-void transition-colors hover:bg-ember-bright disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {kept ? 'Added to Library' : keeping ? 'Saving…' : 'Keep'}
                </button>
              ) : (
                <p className="text-xs text-parchment/50">
                  Create a Library world first (Library tab) to keep NPCs.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
