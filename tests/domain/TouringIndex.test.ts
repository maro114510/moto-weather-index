import { describe, expect, test } from "bun:test";
import {
  computeTouringIndex,
  FACTOR_KEYS,
  type FactorKey,
  ratingFor,
  TouringIndexSchema,
} from "../../src/domain/TouringIndex";

describe("ratingFor", () => {
  test.each([
    [100, "最高", "green"],
    [80, "最高", "green"],
    [79, "良好", "lime"],
    [60, "良好", "lime"],
    [59, "普通", "yellow"],
    [40, "普通", "yellow"],
    [39, "注意", "orange"],
    [20, "注意", "orange"],
    [19, "危険", "red"],
    [0, "危険", "red"],
  ])("score %d is rated %s in %s", (score, label, color) => {
    expect(ratingFor(score)).toEqual({ label, color });
  });

  test.each([-1, 101, 50.5, Number.NaN])("rejects score %p", (score) => {
    expect(() => ratingFor(score)).toThrow();
  });
});

const FACTOR_MAX: Record<FactorKey, number> = {
  weather: 30,
  temperature: 20,
  wind: 15,
  humidity: 10,
  visibility: 5,
  precipitationProbability: 10,
  uvIndex: 5,
  airQuality: 5,
};

// Each value scores its factor's maximum.
const idealObservation = {
  condition: "clear",
  temperature: 21.5,
  windSpeed: 2,
  humidity: 50,
  visibility: 20,
  precipitationProbability: 0,
  uvIndex: 2,
  airQuality: "low",
} as const;

// Scores 15, 15, 10, 6, 2, 7, 3, and 3 points in factor order.
const mixedObservation = {
  condition: "cloudy",
  temperature: 16.5,
  windSpeed: 5,
  humidity: 70,
  visibility: 8,
  precipitationProbability: 30,
  uvIndex: 5,
  airQuality: "medium",
} as const;

const worstObservation = {
  condition: "rain",
  temperature: -50,
  windSpeed: 10,
  humidity: 0,
  visibility: 0,
  precipitationProbability: 100,
  uvIndex: 10,
  airQuality: "high",
} as const;

const tokyoPlace = { name: "東京", latitude: 35.68, longitude: 139.76 };
const noonMoment = { type: "moment", date: "2026-11-20", hour: 12 } as const;
const source = "Open-Meteo";
const fetchedAt = "2026-11-20T10:00:00+09:00";

function indexOf(
  observation: Record<string, unknown>,
  target: unknown = noonMoment,
) {
  return computeTouringIndex({
    place: tokyoPlace,
    target,
    observation,
    source,
    fetchedAt,
  });
}

function without(
  observation: Record<string, unknown>,
  missing: readonly string[],
) {
  const keyOf: Record<FactorKey, string> = {
    weather: "condition",
    temperature: "temperature",
    wind: "windSpeed",
    humidity: "humidity",
    visibility: "visibility",
    precipitationProbability: "precipitationProbability",
    uvIndex: "uvIndex",
    airQuality: "airQuality",
  };
  return Object.fromEntries(
    Object.entries(observation).filter(
      ([key]) => !missing.some((factor) => keyOf[factor as FactorKey] === key),
    ),
  );
}

describe("computeTouringIndex with complete coverage", () => {
  test("ideal weather scores 100 with high confidence and no missing factor", () => {
    const index = indexOf(idealObservation);
    expect(index.score).toBe(100);
    expect(index.rating).toEqual({ label: "最高", color: "green" });
    expect(index.confidence).toBe("high");
    expect(index.missingFactors).toEqual([]);
  });

  test("mixed weather scores the sum of its factor points", () => {
    const index = indexOf(mixedObservation);
    expect(index.score).toBe(61);
    expect(index.rating).toEqual({ label: "良好", color: "lime" });
    expect(index.factors).toEqual([
      { key: "weather", points: 15, max: 30 },
      { key: "temperature", points: 15, max: 20 },
      { key: "wind", points: 10, max: 15 },
      { key: "humidity", points: 6, max: 10 },
      { key: "visibility", points: 2, max: 5 },
      { key: "precipitationProbability", points: 7, max: 10 },
      { key: "uvIndex", points: 3, max: 5 },
      { key: "airQuality", points: 3, max: 5 },
    ]);
  });

  test("the worst weather scores 0 and is rated 危険", () => {
    const index = indexOf(worstObservation);
    expect(index.score).toBe(0);
    expect(index.rating).toEqual({ label: "危険", color: "red" });
  });
});

describe("computeTouringIndex with incomplete coverage", () => {
  test("a missing factor is normalized over the present maximum, not counted as zero", () => {
    const index = indexOf(without(idealObservation, ["airQuality"]));
    expect(index.score).toBe(100);
    expect(index.missingFactors).toEqual(["airQuality"]);
  });

  test("missing visibility and air quality scores 62 from 56 of 90 points", () => {
    const index = indexOf(
      without(mixedObservation, ["visibility", "airQuality"]),
    );
    expect(index.score).toBe(62);
    expect(index.missingFactors).toEqual(["visibility", "airQuality"]);
    expect(index.confidence).toBe("medium");
    expect(index.factors.map((f) => f.key)).toEqual([
      "weather",
      "temperature",
      "wind",
      "humidity",
      "precipitationProbability",
      "uvIndex",
    ]);
  });

  test("a single present factor still yields an index with low confidence", () => {
    const index = indexOf({ condition: "clear" });
    expect(index.score).toBe(100);
    expect(index.confidence).toBe("low");
    expect(index.missingFactors).toEqual([
      "temperature",
      "wind",
      "humidity",
      "visibility",
      "precipitationProbability",
      "uvIndex",
      "airQuality",
    ]);
  });

  test("a single present factor at its worst scores 0", () => {
    expect(indexOf({ airQuality: "high" }).score).toBe(0);
    expect(indexOf({ windSpeed: 10 }).score).toBe(0);
  });

  test("65 of 100 points of coverage is low confidence", () => {
    const index = indexOf({
      condition: "clear",
      temperature: 21.5,
      windSpeed: 2,
    });
    expect(index.confidence).toBe("low");
  });

  test("70 of 100 points of coverage is medium confidence", () => {
    const index = indexOf({
      condition: "clear",
      temperature: 21.5,
      windSpeed: 2,
      visibility: 20,
    });
    expect(index.confidence).toBe("medium");
  });

  test("95 of 100 points of coverage is medium confidence", () => {
    const index = indexOf(without(idealObservation, ["uvIndex"]));
    expect(index.confidence).toBe("medium");
  });

  test("an observation with no factor has no index", () => {
    expect(() => indexOf({})).toThrow();
  });

  test("every non-empty combination of factors stays within 0 to 100 and reports exactly its missing factors", () => {
    const names = FACTOR_KEYS;
    for (let mask = 1; mask < 1 << names.length; mask++) {
      const missing = names.filter((_, bit) => (mask & (1 << bit)) === 0);
      const present = names.filter((_, bit) => (mask & (1 << bit)) !== 0);
      for (const observation of [
        idealObservation,
        mixedObservation,
        worstObservation,
      ]) {
        const index = indexOf(without(observation, missing));
        const presentMax = present.reduce(
          (sum, key) => sum + FACTOR_MAX[key],
          0,
        );
        expect(Number.isInteger(index.score)).toBe(true);
        expect(index.score).toBeGreaterThanOrEqual(0);
        expect(index.score).toBeLessThanOrEqual(100);
        expect(index.missingFactors).toEqual(missing);
        expect(index.factors.map((f) => f.key)).toEqual(present);
        expect(index.confidence).toBe(
          presentMax === 100 ? "high" : presentMax >= 70 ? "medium" : "low",
        );
        expect(TouringIndexSchema.safeParse(index).success).toBe(true);
      }
    }
  });
});

describe("computeTouringIndex metadata", () => {
  test("carries the place, a moment target, the source, and the freshness", () => {
    const index = indexOf(idealObservation);
    expect(index.place).toEqual(tokyoPlace);
    expect(index.target).toEqual({
      type: "moment",
      date: "2026-11-20",
      hour: 12,
    });
    expect(index.source).toBe("Open-Meteo");
    expect(index.freshness).toBe("2026-11-20T10:00:00+09:00");
  });

  test("carries a day target", () => {
    const index = indexOf(idealObservation, {
      type: "day",
      date: "2026-11-21",
    });
    expect(index.target).toEqual({ type: "day", date: "2026-11-21" });
  });

  test.each([
    ["an impossible date", { type: "day", date: "2026-02-30" }],
    ["an hour of 24", { type: "moment", date: "2026-11-20", hour: 24 }],
    ["a fractional hour", { type: "moment", date: "2026-11-20", hour: 1.5 }],
  ])("rejects %s as the target", (_name, target) => {
    expect(() => indexOf(idealObservation, target)).toThrow();
  });

  test.each([
    ["humidity above 100", { ...idealObservation, humidity: 120 }],
    ["an unknown condition name", { ...idealObservation, condition: "hail" }],
    ["a negative wind speed", { ...idealObservation, windSpeed: -1 }],
    ["a non-numeric temperature", { ...idealObservation, temperature: "warm" }],
  ])("rejects %s in the observation", (_name, observation) => {
    expect(() => indexOf(observation)).toThrow();
  });

  test("rejects an empty source and a freshness without a time zone", () => {
    expect(() =>
      computeTouringIndex({
        place: tokyoPlace,
        target: noonMoment,
        observation: idealObservation,
        source: "",
        fetchedAt,
      }),
    ).toThrow();
    expect(() =>
      computeTouringIndex({
        place: tokyoPlace,
        target: noonMoment,
        observation: idealObservation,
        source,
        fetchedAt: "2026-11-20T10:00:00",
      }),
    ).toThrow();
  });
});

describe("TouringIndexSchema", () => {
  const valid = () => indexOf(mixedObservation);

  test("accepts a computed index", () => {
    expect(TouringIndexSchema.safeParse(valid()).success).toBe(true);
  });

  test("rejects a score above 100", () => {
    expect(
      TouringIndexSchema.safeParse({ ...valid(), score: 101 }).success,
    ).toBe(false);
  });

  test("rejects a factor that is both present and reported missing", () => {
    expect(
      TouringIndexSchema.safeParse({ ...valid(), missingFactors: ["weather"] })
        .success,
    ).toBe(false);
  });

  test("rejects an index that accounts for fewer than eight factors", () => {
    const index = valid();
    expect(
      TouringIndexSchema.safeParse({
        ...index,
        factors: index.factors.slice(1),
      }).success,
    ).toBe(false);
  });

  test("rejects an index without a source", () => {
    const { source: _source, ...rest } = valid();
    expect(TouringIndexSchema.safeParse(rest).success).toBe(false);
  });
});
