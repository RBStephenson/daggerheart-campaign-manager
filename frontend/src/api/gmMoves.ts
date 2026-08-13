import { apiGet } from './client';

export interface GmMovesData {
  when_to_move: string[];
  soft_vs_hard: {
    soft: string;
    hard: string;
    guidance: string;
  };
  moves: string[];
}

export function getGmMoves(): Promise<GmMovesData> {
  return apiGet('/api/gm-moves/');
}
