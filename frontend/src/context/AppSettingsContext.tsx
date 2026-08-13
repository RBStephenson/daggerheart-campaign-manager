import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { apiGet, apiPut } from '../api/client';
import { useAuth } from './AuthContext';

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
  library_enabled: false,
  session_planning_enabled: false,
  character_sheet_enabled: false,
  downtime_enabled: false,
  combat_tools_enabled: false,
  generators_enabled: false,
  custom_content_enabled: false,
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
  const { user } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  // Refetch whenever the authenticated user changes (login/logout/switch
  // account), not just once at initial app boot. GET /api/settings requires
  // a GM session, so a fetch that only ran on mount would 401 on the
  // pre-login boot request and never retry — every setting would silently
  // stay at its DEFAULTS value for the rest of the session even after a
  // real GM logged in, with no client-side hard reload to paper over it.
  useEffect(() => {
    if (!user) {
      setSettings(DEFAULTS);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
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
  }, [user]);

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
