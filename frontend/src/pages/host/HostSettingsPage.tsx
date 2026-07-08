import { useAppSettings } from '../../context/AppSettingsContext';

export default function HostSettingsPage() {
  const { settings, loading } = useAppSettings();

  if (loading) return <p className="text-slate-600">Loading settings…</p>;

  const entries = Object.entries(settings);
  return (
    <div aria-label="Settings">
      {entries.length === 0 ? (
        <p className="text-slate-600">No settings yet. Feature toggles will appear here.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {entries.map(([key, value]) => (
            <li key={key} className="px-4 py-2 text-sm text-slate-700">
              {key}: {String(value)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
