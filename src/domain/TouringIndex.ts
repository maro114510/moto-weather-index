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

export const TouringIndexScoreSchema = z.number().int().min(0).max(100);

export const RatingSchema = z.object({
  label: z.enum(["最高", "良好", "普通", "注意", "危険"]),
  color: z.enum(["green", "lime", "yellow", "orange", "red"]),
});
export type Rating = z.infer<typeof RatingSchema>;

/**
 * Bands keep the thresholds of the previous interface so that a score keeps
 * the rating riders already know.
 */
export function ratingFor(score: number): Rating {
  const valid = TouringIndexScoreSchema.parse(score);
  if (valid >= 80) return { label: "最高", color: "green" };
  if (valid >= 60) return { label: "良好", color: "lime" };
  if (valid >= 40) return { label: "普通", color: "yellow" };
  if (valid >= 20) return { label: "注意", color: "orange" };
  return { label: "危険", color: "red" };
}

export const TouringIndexSchema = z.any();
export type TouringIndex = any;

export function computeTouringIndex(_input: unknown): TouringIndex {
  return {};
}
