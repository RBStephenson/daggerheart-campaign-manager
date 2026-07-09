import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { apiGet, apiPut } from '../api/client';

/**
 * All application settings. Mirror of backend DEFAULTS in
 * backend/app/routers/settings.py — keep the two in sync.
 * Feature flags are named `<feature>_enabled` and default to false,
 * which keeps gated UI hidden during the initial settings fetch.
 */
export interface AppSettings {
  [key: string]: boolean | number | string;
}

export const DEFAULTS: AppSettings = {
  realtime_enabled: false,
  campaigns_enabled: false,
  chat_enabled: false,
  player_area_enabled: false,
  data_management_enabled: false,
  character_creation_enabled: false,
};

interface AppSettingsContextValue {
  settings: AppSettings;
  loading: boolean;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
}

const AppSettingsContext = createContext<AppSettingsContextValue>({
  settings: DEFAULTS,
  loading: true,
  updateSettings: async () => {
    throw new Error('AppSettingsProvider missing');
  },
});

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiGet<AppSettings>('/api/settings')
      .then((data) => {
        if (!cancelled) setSettings(data);
      })
      .catch((err: unknown) => {
        console.error('Failed to load settings; using defaults', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    const data = await apiPut<AppSettings>('/api/settings', updates);
    setSettings(data);
  }, []);

  return (
    <AppSettingsContext.Provider value={{ settings, loading, updateSettings }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings(): AppSettingsContextValue {
  return useContext(AppSettingsContext);
}
