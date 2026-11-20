import { z } from "zod";
import {
  airQualityScore,
  humidityScore,
  precipitationProbabilityScore,
  temperatureScore,
  uvIndexScore,
  visibilityScore,
  weatherScore,
  windScore,
} from "./ScoreRules";
import { AirQualityLevelSchema, WeatherConditionSchema } from "./Weather";

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

/** The maxima of the eight factors form the basis of 100. */
export const FACTOR_MAX: Record<FactorKey, number> = {
  weather: 30,
  temperature: 20,
  wind: 15,
  humidity: 10,
  visibility: 5,
  precipitationProbability: 10,
  uvIndex: 5,
  airQuality: 5,
};

/** Coverage at or above this share of the basis, short of complete, is medium confidence. */
const MEDIUM_CONFIDENCE_MIN_COVERAGE = 70;

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

export const PlaceSchema = z.object({
  name: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export type Place = z.infer<typeof PlaceSchema>;

const DateSchema = z.iso.date();

/** A date and hour in Japan Standard Time, or a calendar date in Japan Standard Time. */
export const TargetSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("moment"),
    date: DateSchema,
    hour: z.number().int().min(0).max(23),
  }),
  z.object({ type: z.literal("day"), date: DateSchema }),
]);
export type Target = z.infer<typeof TargetSchema>;

/** Every factor is optional because the weather source may omit any of them. */
export const ObservationSchema = z.object({
  condition: WeatherConditionSchema.optional(),
  temperature: z.number().min(-50).max(60).optional(),
  windSpeed: z.number().min(0).max(100).optional(),
  humidity: z.number().min(0).max(100).optional(),
  visibility: z.number().min(0).max(100).optional(),
  precipitationProbability: z.number().min(0).max(100).optional(),
  uvIndex: z.number().min(0).max(20).optional(),
  airQuality: AirQualityLevelSchema.optional(),
});
export type Observation = z.infer<typeof ObservationSchema>;

export const ConfidenceSchema = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

const FactorKeySchema = z.enum(FACTOR_KEYS);

export const FactorScoreSchema = z
  .object({
    key: FactorKeySchema,
    points: z.number().int().min(0),
    max: z.number().int().positive(),
  })
  .refine((f) => f.max === FACTOR_MAX[f.key] && f.points <= f.max, {
    message: "a factor scores within its own maximum",
  });
export type FactorScore = z.infer<typeof FactorScoreSchema>;

export const TouringIndexSchema = z
  .object({
    place: PlaceSchema,
    target: TargetSchema,
    score: TouringIndexScoreSchema,
    rating: RatingSchema,
    factors: z.array(FactorScoreSchema).min(1),
    missingFactors: z.array(FactorKeySchema),
    confidence: ConfidenceSchema,
    source: z.string().min(1),
    freshness: z.iso.datetime({ offset: true }),
  })
  .superRefine((index, ctx) => {
    const present = index.factors.map((f) => f.key);
    const accounted = [...present, ...index.missingFactors];
    if (
      new Set(accounted).size !== FACTOR_KEYS.length ||
      accounted.length !== FACTOR_KEYS.length
    ) {
      ctx.addIssue({
        code: "custom",
        message: "every factor is either present or reported missing, once",
      });
    }
  });
export type TouringIndex = z.infer<typeof TouringIndexSchema>;

export const TouringIndexInputSchema = z.object({
  place: PlaceSchema,
  target: TargetSchema,
  observation: ObservationSchema,
  source: z.string().min(1),
  fetchedAt: z.iso.datetime({ offset: true }),
});
export type TouringIndexInput = z.infer<typeof TouringIndexInputSchema>;

function scoreFactors(o: Observation): Record<FactorKey, number | undefined> {
  return {
    weather: o.condition === undefined ? undefined : weatherScore(o.condition),
    temperature:
      o.temperature === undefined ? undefined : temperatureScore(o.temperature),
    wind: o.windSpeed === undefined ? undefined : windScore(o.windSpeed),
    humidity: o.humidity === undefined ? undefined : humidityScore(o.humidity),
    visibility:
      o.visibility === undefined ? undefined : visibilityScore(o.visibility),
    precipitationProbability:
      o.precipitationProbability === undefined
        ? undefined
        : precipitationProbabilityScore(o.precipitationProbability),
    uvIndex: o.uvIndex === undefined ? undefined : uvIndexScore(o.uvIndex),
    airQuality:
      o.airQuality === undefined ? undefined : airQualityScore(o.airQuality),
  };
}

/**
 * Normalizes over the factors present, so a missing factor neither suppresses
 * the index nor counts as zero points.
 * @throws ZodError if the input is invalid or the observation has no factor
 */
export function computeTouringIndex(input: unknown): TouringIndex {
  const { place, target, observation, source, fetchedAt } =
    TouringIndexInputSchema.parse(input);
  const points = scoreFactors(observation);

  const factors: FactorScore[] = [];
  const missingFactors: FactorKey[] = [];
  for (const key of FACTOR_KEYS) {
    const value = points[key];
    if (value === undefined) missingFactors.push(key);
    else factors.push({ key, points: value, max: FACTOR_MAX[key] });
  }
  if (factors.length === 0) {
    throw new Error("an observation needs at least one factor to score");
  }

  const presentMax = factors.reduce((sum, f) => sum + f.max, 0);
  const presentPoints = factors.reduce((sum, f) => sum + f.points, 0);
  const score = Math.round((presentPoints * 100) / presentMax);
  const confidence: Confidence =
    presentMax === 100
      ? "high"
      : presentMax >= MEDIUM_CONFIDENCE_MIN_COVERAGE
        ? "medium"
        : "low";

  return TouringIndexSchema.parse({
    place,
    target,
    score,
    rating: ratingFor(score),
    factors,
    missingFactors,
    confidence,
    source,
    freshness: fetchedAt,
  });
}
