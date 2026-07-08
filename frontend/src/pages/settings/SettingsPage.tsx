import { useAppSettings } from '../../context/AppSettingsContext';

export default function SettingsPage() {
  const { settings, loading } = useAppSettings();

  if (loading) return <p>Loading settings…</p>;

  const entries = Object.entries(settings);
  return (
    <section aria-label="Settings">
      <h1>Settings</h1>
      {entries.length === 0 ? (
        <p>No settings yet. Feature toggles will appear here.</p>
      ) : (
        <ul>
          {entries.map(([key, value]) => (
            <li key={key}>
              {key}: {String(value)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
