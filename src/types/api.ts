import type { TouringScoreFactors } from "../domain/TouringScore";

/**
 * Result of touring index calculation
 */
export interface TouringIndexResult {
  score: number;
  breakdown: TouringScoreFactors;
}

/**
 * Historical touring index record from database
 */
export interface TouringIndexHistoryRecord {
  date: string;
  score: number;
  factors: Record<string, number>;
  calculated_at: string;
}

/**
 * API response for touring index calculation
 */
export interface TouringIndexResponse {
  location: {
    lat: number;
    lon: number;
  };
  datetime: string;
  score: number;
  factors: TouringScoreFactors;
}

/**
 * API response for touring index history
 */
export interface TouringIndexHistoryResponse {
  location: {
    lat: number;
    lon: number;
  };
  prefecture_id: number;
  data: TouringIndexHistoryRecord[];
}
