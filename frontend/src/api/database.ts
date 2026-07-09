import { ApiError } from './client';

export interface DatabaseHealth {
  ok: boolean;
  status: 'healthy' | 'corrupt';
  detail: string;
}

export interface RepairResult extends DatabaseHealth {
  before: string;
  repaired: boolean;
  snapshot: string | null;
}

export interface SnapshotResult {
  ok: boolean;
  snapshot: string | null;
}

async function download(path: string, fallbackFilename: string): Promise<void> {
  const resp = await fetch(path, { credentials: 'include' });
  if (!resp.ok) {
    throw new ApiError(resp.status, `GET ${path} failed (${resp.status})`);
  }
  const blob = await resp.blob();
  const disposition = resp.headers.get('content-disposition') ?? '';
  const match = /filename="?([^";]+)"?/.exec(disposition);
  const filename = match?.[1] ?? fallbackFilename;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function postForResult<T extends object>(path: string): Promise<T> {
  const resp = await fetch(path, { method: 'POST', credentials: 'include' });
  const body = (await resp.json()) as T & { detail?: string };
  if (!resp.ok) {
    throw new ApiError(resp.status, body.detail ?? `POST ${path} failed (${resp.status})`);
  }
  return body;
}

export const database = {
  backup: () => download('/api/database/backup', 'dhcm_backup.db'),

  health: async (): Promise<DatabaseHealth> => {
    const resp = await fetch('/api/database/health', { credentials: 'include' });
    const body = (await resp.json()) as DatabaseHealth & { detail?: string };
    if (!resp.ok) {
      throw new ApiError(resp.status, body.detail ?? `GET /api/database/health failed (${resp.status})`);
    }
    return body;
  },

  repair: () => postForResult<RepairResult>('/api/database/repair'),

  restore: async (file: File): Promise<SnapshotResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const resp = await fetch('/api/database/restore', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    const body = (await resp.json()) as SnapshotResult & { detail?: string };
    if (!resp.ok) {
      throw new ApiError(resp.status, body.detail ?? `POST /api/database/restore failed (${resp.status})`);
    }
    return body;
  },

  reset: () => postForResult<SnapshotResult>('/api/database/reset'),
};
