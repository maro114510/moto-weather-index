import { z } from "zod";

export const FACTOR_KEYS = [
  "weather",
  "temperature",
  "wind",
  "humidity",
  "visibility",
  "precipitationProbability",
  "uvIndex",
  "airQuality",
] as const;
export type FactorKey = (typeof FACTOR_KEYS)[number];

export const TouringIndexSchema = z.any();
export type TouringIndex = any;

export function ratingFor(_score: number): any {
  return { label: "危険", color: "red" };
}

export function computeTouringIndex(_input: unknown): TouringIndex {
  return {};
}
