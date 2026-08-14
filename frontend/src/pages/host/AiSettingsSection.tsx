import { useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import {
  createAiApiConfig,
  deleteAiApiConfig,
  listAiApiConfigs,
  updateAiApiConfig,
  type AiApiConfig,
} from '../../api/ai';
import { useAppSettings } from '../../context/AppSettingsContext';

const inputClass =
  'w-full rounded-md border border-admin-border bg-admin-card px-3 py-2 text-sm text-admin-heading focus:border-admin-accent focus:outline-none dark:border-admin-border-dark dark:bg-admin-bg-dark dark:text-admin-heading-dark';

function errMsg(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}

function ConfigFields({ config }: { config?: AiApiConfig }) {
  return (
    <>
      <input
        name="name"
        placeholder="Name"
        required
        defaultValue={config?.name ?? ''}
        className={inputClass}
      />
      <select name="api_type" defaultValue={config?.api_type ?? 'anthropic'} className={inputClass}>
        <option value="anthropic">Anthropic</option>
        <option value="openai">OpenAI-compatible</option>
      </select>
      <input
        name="model"
        placeholder="Model"
        defaultValue={config?.model ?? ''}
        className={inputClass}
      />
      <input
        name="url"
        placeholder="Base URL (optional, for OpenAI-compatible endpoints)"
        defaultValue={config?.url ?? ''}
        className={inputClass}
      />
      <input
        name="api_key"
        type="password"
        placeholder={config?.key_set ? `API key (set, ${config.key_hint}) — leave blank to keep` : 'API key'}
        className={inputClass}
      />
    </>
  );
}

function readForm(form: FormData) {
  const raw = (name: string) => String(form.get(name) ?? '').trim();
  const body: Record<string, unknown> = {
    name: raw('name'),
    api_type: raw('api_type'),
    model: raw('model'),
    url: raw('url') === '' ? null : raw('url'),
  };
  const apiKey = raw('api_key');
  if (apiKey !== '') body.api_key = apiKey;
  return body;
}

export default function AiSettingsSection() {
  const { settings, updateSettings } = useAppSettings();
  const [configs, setConfigs] = useState<AiApiConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    listAiApiConfigs()
      .then(setConfigs)
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    setError(null);
    try {
      await createAiApiConfig(readForm(new FormData(formEl)) as never);
      formEl.reset();
      load();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const handleUpdate = async (id: number, e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    try {
      await updateAiApiConfig(id, readForm(new FormData(e.currentTarget)) as never);
      setEditingId(null);
      load();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const handleDelete = async (id: number) => {
    setError(null);
    try {
      await deleteAiApiConfig(id);
      // Selected config was deleted out from under the setting — clear it
      // rather than leave ai_text_api pointing at a dangling id.
      if (settings.ai_text_api === id) {
        await updateSettings({ ai_text_api: null });
      }
      load();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const selectedId = typeof settings.ai_text_api === 'number' ? settings.ai_text_api : null;

  return (
    <div aria-label="AI Text Generation" className="mt-8">
      <h2 className="mb-1 text-sm font-semibold text-admin-heading dark:text-admin-heading-dark">
        AI Text Generation
      </h2>
      <p className="mb-4 text-sm text-admin-subtext dark:text-admin-subtext-dark">
        API endpoint configs used for AI-assisted draft text on Library entity forms. Drafts are
        never auto-saved — the GM reviews and accepts each one.
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="mb-6 flex items-center gap-3">
        <label
          htmlFor="ai_text_api"
          className="text-sm font-medium text-admin-heading dark:text-admin-heading-dark"
        >
          Active config
        </label>
        <select
          id="ai_text_api"
          className={inputClass}
          style={{ maxWidth: '20rem' }}
          value={selectedId ?? ''}
          onChange={(e) =>
            void updateSettings({ ai_text_api: e.target.value === '' ? null : Number(e.target.value) })
          }
        >
          <option value="">None selected</option>
          {configs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <form
        onSubmit={(e) => void handleCreate(e)}
        className="mb-6 flex max-w-md flex-col gap-2 rounded-md border border-admin-border bg-admin-card p-4 dark:border-admin-border-dark dark:bg-admin-card-dark"
      >
        <h3 className="mb-1 text-sm font-semibold text-admin-heading dark:text-admin-heading-dark">
          Add AI API config
        </h3>
        <ConfigFields />
        <button
          type="submit"
          className="self-start rounded-md bg-admin-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Create
        </button>
      </form>

      {loading ? (
        <p className="text-admin-subtext dark:text-admin-subtext-dark">Loading…</p>
      ) : configs.length === 0 ? (
        <p className="text-admin-subtext dark:text-admin-subtext-dark">No AI API configs yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {configs.map((config) => (
            <li
              key={config.id}
              className="rounded-md border border-admin-border bg-admin-card p-4 dark:border-admin-border-dark dark:bg-admin-card-dark"
            >
              {editingId === config.id ? (
                <form
                  onSubmit={(e) => void handleUpdate(config.id, e)}
                  className="flex flex-col gap-2"
                >
                  <ConfigFields config={config} />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="rounded-md bg-admin-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-md px-3 py-2 text-sm text-admin-subtext hover:text-admin-heading dark:text-admin-subtext-dark dark:hover:text-admin-heading-dark"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <h3 className="font-medium text-admin-heading dark:text-admin-heading-dark">
                    {config.name}
                  </h3>
                  <p className="text-sm text-admin-subtext dark:text-admin-subtext-dark">
                    {config.api_type} · {config.model || 'no model set'} ·{' '}
                    {config.key_set ? `key set (${config.key_hint})` : 'no key set'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(config.id)}
                      className="rounded-md border border-admin-border px-3 py-1.5 text-xs text-admin-heading hover:bg-admin-divider dark:border-admin-border-dark dark:text-admin-heading-dark dark:hover:bg-admin-divider-dark"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(config.id)}
                      className="rounded-md border border-admin-border px-3 py-1.5 text-xs text-admin-heading hover:bg-admin-divider dark:border-admin-border-dark dark:text-admin-heading-dark dark:hover:bg-admin-divider-dark"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
