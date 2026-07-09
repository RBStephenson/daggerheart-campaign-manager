import { apiGet } from './client';

export interface ChatMessage {
  id: number;
  room: string;
  author_user_id: number;
  author_username: string;
  body: string;
  created_at: string;
}

export function listChatHistory(room: string): Promise<ChatMessage[]> {
  return apiGet(`/api/chat/${room}/messages`);
}
