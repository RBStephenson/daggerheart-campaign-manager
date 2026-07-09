import { useState } from 'react';
import ToggleSwitch from '../../components/ui/ToggleSwitch';
import { useAppSettings } from '../../context/AppSettingsContext';

const FLAG_INFO: Record<string, { label: string; description: string }> = {
  realtime_enabled: {
    label: 'Realtime',
    description: 'WebSocket sync across host, GM, and player views.',
  },
  chat_enabled: {
    label: 'Chat',
    description: 'Table chat during active sessions.',
  },
  campaigns_enabled: {
    label: 'Campaigns',
    description: 'Gamemaster campaign & session management.',
  },
  player_area_enabled: {
    label: 'Player area',
    description: 'Characters, notes, and campaign membership for players.',
  },
  character_creation_enabled: {
    label: 'Character creation',
    description: 'Guided Level 1 character creation for players.',
  },
  data_management_enabled: {
    label: 'Data management',
    description: 'Backup, restore, repair, and reset the database.',
  },
};

export default function HostSettingsPage() {
  const { settings, loading, updateSettings } = useAppSettings();
  const [pending, setPending] = useState<string | null>(null);

  if (loading) {
    return <p className="text-admin-subtext dark:text-admin-subtext-dark">Loading settings…</p>;
  }

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
        <p className="text-admin-subtext dark:text-admin-subtext-dark">
          No settings yet. Feature toggles will appear here.
        </p>
      ) : (
        <ul className="divide-y divide-admin-divider rounded-md border border-admin-border bg-admin-card dark:divide-admin-divider-dark dark:border-admin-border-dark dark:bg-admin-card-dark">
          {entries.map(([key, value]) => {
            const isBoolean = typeof value === 'boolean';
            const info = FLAG_INFO[key];
            return (
              <li key={key} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-admin-heading dark:text-admin-heading-dark">
                    {info?.label ?? key}
                  </p>
                  {info?.description && (
                    <p className="text-sm text-admin-subtext dark:text-admin-subtext-dark">
                      {info.description}
                    </p>
                  )}
                </div>
                {isBoolean ? (
                  <ToggleSwitch
                    checked={value}
                    disabled={pending === key}
                    onChange={() => toggle(key, value)}
                    aria-label={key}
                  />
                ) : (
                  <span className="text-admin-heading dark:text-admin-heading-dark">
                    {String(value)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
