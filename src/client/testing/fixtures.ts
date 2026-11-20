import type { FactorKey, TouringIndex } from "../../domain/TouringIndex";

const FACTORS: { key: FactorKey; points: number; max: number }[] = [
  { key: "weather", points: 30, max: 30 },
  { key: "temperature", points: 20, max: 20 },
  { key: "wind", points: 15, max: 15 },
  { key: "humidity", points: 10, max: 10 },
  { key: "visibility", points: 5, max: 5 },
  { key: "precipitationProbability", points: 10, max: 10 },
  { key: "uvIndex", points: 5, max: 5 },
  { key: "airQuality", points: 5, max: 5 },
];

const SHIBUYA = { name: "渋谷", latitude: 35.6589, longitude: 139.70665 };

/** A complete index with a perfect score, which a test changes where it matters. */
export function completeIndex(overrides: Partial<TouringIndex> = {}) {
  return {
    place: SHIBUYA,
    target: { type: "moment", date: "2026-11-21", hour: 10 },
    score: 100,
    rating: { label: "最高", color: "green" },
    factors: FACTORS,
    missingFactors: [],
    confidence: "high",
    source: "Open-Meteo",
    freshness: "2026-11-20T02:30:00.000Z",
    ...overrides,
  } as TouringIndex;
}

/** The index of a source that returned no air quality and no UV index. */
export function incompleteIndex(overrides: Partial<TouringIndex> = {}) {
  return completeIndex({
    score: 71,
    rating: { label: "良好", color: "lime" },
    factors: FACTORS.filter(
      (f) => f.key !== "airQuality" && f.key !== "uvIndex",
    ).map((f) => ({ ...f, points: Math.round(f.max * 0.7) })),
    missingFactors: ["uvIndex", "airQuality"],
    confidence: "medium",
    ...overrides,
  });
}

/** One day per date, each with the given score and confidence. */
export function weekOf(
  dates: string[],
  make: (date: string, i: number) => Partial<TouringIndex> = () => ({}),
) {
  return dates.map((date, i) =>
    completeIndex({ target: { type: "day", date }, ...make(date, i) }),
  );
}
