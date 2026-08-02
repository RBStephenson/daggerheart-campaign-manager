import { apiDelete, apiGet, apiPost, apiPut } from './client';

export interface SessionPlanContent {
  beats?: { name: string; description?: string; npc_ids?: number[] }[];
  countdowns?: {
    name: string;
    max_segments: number;
    trigger?: string;
    on_complete?: string;
    on_intervention?: string;
  }[];
  hooks?: string[];
  notes?: string;
  [key: string]: unknown;
}

export interface SessionPlan {
  id: number;
  campaign_id: number;
  title: string;
  summary: string;
  order: number;
  content: SessionPlanContent;
  created_at: string;
  updated_at: string;
}

export type LibraryEntityType =
  | 'continent'
  | 'region'
  | 'location'
  | 'faction'
  | 'npc'
  | 'adversary';

export interface SessionPlanLibraryLink {
  id: number;
  session_plan_id: number;
  entity_type: LibraryEntityType;
  entity_id: number;
  created_at: string;
}

export function listSessionPlans(campaignId: number): Promise<SessionPlan[]> {
  return apiGet(`/api/campaigns/${campaignId}/session-plans`);
}

export function createSessionPlan(
  campaignId: number,
  body: { title: string; summary?: string; order?: number; content?: SessionPlanContent },
): Promise<SessionPlan> {
  return apiPost(`/api/campaigns/${campaignId}/session-plans`, body);
}

export function updateSessionPlan(
  campaignId: number,
  planId: number,
  updates: Partial<Pick<SessionPlan, 'title' | 'summary' | 'order' | 'content'>>,
): Promise<SessionPlan> {
  return apiPut(`/api/campaigns/${campaignId}/session-plans/${planId}`, updates);
}

export function deleteSessionPlan(campaignId: number, planId: number): Promise<void> {
  return apiDelete(`/api/campaigns/${campaignId}/session-plans/${planId}`);
}

export function listLinks(campaignId: number, planId: number): Promise<SessionPlanLibraryLink[]> {
  return apiGet(`/api/campaigns/${campaignId}/session-plans/${planId}/links`);
}

export function createLink(
  campaignId: number,
  planId: number,
  body: { entity_type: LibraryEntityType; entity_id: number },
): Promise<SessionPlanLibraryLink> {
  return apiPost(`/api/campaigns/${campaignId}/session-plans/${planId}/links`, body);
}

export function deleteLink(campaignId: number, planId: number, linkId: number): Promise<void> {
  return apiDelete(`/api/campaigns/${campaignId}/session-plans/${planId}/links/${linkId}`);
}
