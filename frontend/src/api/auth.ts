import { apiPost } from './client';

export interface Invite {
  token: string;
  role: string;
}

export function createInvite(role: string): Promise<Invite> {
  return apiPost('/api/auth/invites', { role });
}
