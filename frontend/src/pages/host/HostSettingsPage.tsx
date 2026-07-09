import { useState } from 'react';
import { useAppSettings } from '../../context/AppSettingsContext';

export default function HostSettingsPage() {
  const { settings, loading, updateSettings } = useAppSettings();
  const [pending, setPending] = useState<string | null>(null);

  if (loading) return <p className="text-slate-600">Loading settings…</p>;

  const entries = Object.entries(settings);

  const toggle = async (key: string, value: boolean) => {
    setPending(key);
    try {
      await updateSettings({ [key]: !value });
    } finally {
      setPending(null);
    }
  };

  return (
    <div aria-label="Settings">
      {entries.length === 0 ? (
        <p className="text-slate-600">No settings yet. Feature toggles will appear here.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {entries.map(([key, value]) => {
            const isBoolean = typeof value === 'boolean';
            return (
              <li key={key} className="flex items-center justify-between px-4 py-2 text-sm text-slate-700">
                <span>{key}</span>
                {isBoolean ? (
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={value}
                      disabled={pending === key}
                      onChange={() => toggle(key, value)}
                      aria-label={key}
                    />
                  </label>
                ) : (
                  <span>{String(value)}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
