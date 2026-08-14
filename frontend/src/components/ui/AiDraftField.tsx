import { useRef, useState } from 'react';
import { ApiError } from '../../api/client';
import { generateAiText } from '../../api/ai';
import { useAppSettings } from '../../context/AppSettingsContext';

function errMsg(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}

// Everything else currently filled in on the enclosing form, as context for
// the model -- excludes the field being generated so the draft isn't primed
// on its own (possibly stale) contents.
function collectExistingFields(form: HTMLFormElement, excludeName: string): Record<string, string> {
  const data = new FormData(form);
  const out: Record<string, string> = {};
  for (const [key, value] of data.entries()) {
    if (key === excludeName) continue;
    const str = String(value).trim();
    if (str) out[key] = str;
  }
  return out;
}

/**
 * A textarea with an optional "Generate" affordance beneath it (DHCM-98).
 * The affordance is entirely hidden when `ai_text_enabled` is off -- the
 * textarea itself always renders normally either way. A generated draft is
 * shown for review and only lands in the field if the GM explicitly accepts
 * it; nothing is ever auto-saved.
 */
export default function AiDraftField({
  name,
  label,
  placeholder,
  defaultValue,
  required,
  entityType,
  className,
}: {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  entityType: string;
  className: string;
}) {
  const { settings } = useAppSettings();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [prompting, setPrompting] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [draft, setDraft] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    const form = textareaRef.current?.form;
    if (!form) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await generateAiText({
        entity_type: entityType,
        existing_fields: collectExistingFields(form, name),
        prompt: promptText.trim() || `Write a ${label.toLowerCase()} for this ${entityType}.`,
      });
      setDraft(result.draft);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setGenerating(false);
    }
  }

  function accept() {
    if (textareaRef.current && draft !== null) {
      textareaRef.current.value = draft;
    }
    setDraft(null);
    setPrompting(false);
    setPromptText('');
  }

  function discard() {
    setDraft(null);
  }

  return (
    <div className="flex flex-col gap-1">
      <textarea
        ref={textareaRef}
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        className={className}
      />
      {settings.ai_text_enabled && (
        <div className="flex flex-col gap-1">
          {!prompting && draft === null && (
            <button
              type="button"
              onClick={() => setPrompting(true)}
              className="self-start text-xs text-ember hover:text-ember-bright"
            >
              ✨ Generate {label.toLowerCase()}
            </button>
          )}
          {prompting && draft === null && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="Describe what to generate (optional)"
                aria-label={`Generate ${label} prompt`}
                className={`${className} flex-1 text-xs`}
              />
              <button
                type="button"
                disabled={generating}
                onClick={() => void handleGenerate()}
                className="rounded-md bg-ember px-2 py-1 text-xs font-semibold text-void hover:bg-ember-bright disabled:opacity-50"
              >
                {generating ? 'Generating…' : 'Generate'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrompting(false);
                  setPromptText('');
                }}
                className="text-xs text-parchment/50 hover:text-parchment"
              >
                Cancel
              </button>
            </div>
          )}
          {draft !== null && (
            <div className="rounded-md border border-ember/40 bg-ember/5 p-2">
              <p className="mb-2 whitespace-pre-wrap text-xs text-parchment/80">{draft}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={accept}
                  className="rounded-md bg-ember px-2 py-1 text-xs font-semibold text-void hover:bg-ember-bright"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={discard}
                  className="text-xs text-parchment/50 hover:text-parchment"
                >
                  Discard
                </button>
              </div>
            </div>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
