import { apiDelete, apiGet, apiPatch, apiPost } from './client';

export interface AiApiConfig {
  id: number;
  name: string;
  api_type: 'anthropic' | 'openai';
  url: string | null;
  model: string;
  effort: 'low' | 'medium' | 'high' | null;
  request_timeout: number;
  batch_size: number | null;
  reasoning_enabled: boolean;
  key_set: boolean;
  key_hint: string | null;
  created_at: string;
}

export interface AiApiConfigCreate {
  name: string;
  api_type: 'anthropic' | 'openai';
  url?: string | null;
  model?: string;
  effort?: 'low' | 'medium' | 'high' | null;
  request_timeout?: number;
  batch_size?: number | null;
  reasoning_enabled?: boolean;
  api_key?: string | null;
}

export type AiApiConfigUpdate = Partial<AiApiConfigCreate>;

const BASE = '/api/settings/ai-apis';

export function listAiApiConfigs(): Promise<AiApiConfig[]> {
  return apiGet(BASE);
}

export function createAiApiConfig(body: AiApiConfigCreate): Promise<AiApiConfig> {
  return apiPost(BASE, body);
}

export function updateAiApiConfig(id: number, body: AiApiConfigUpdate): Promise<AiApiConfig> {
  return apiPatch(`${BASE}/${id}`, body);
}

export function deleteAiApiConfig(id: number): Promise<void> {
  return apiDelete(`${BASE}/${id}`);
}

export interface AiTextGenerateRequest {
  entity_type: string;
  existing_fields?: Record<string, string>;
  prompt: string;
}

export interface AiTextGenerateResponse {
  draft: string;
}

export function generateAiText(body: AiTextGenerateRequest): Promise<AiTextGenerateResponse> {
  return apiPost('/api/ai/generate', body);
}
