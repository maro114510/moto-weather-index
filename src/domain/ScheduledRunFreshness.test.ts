import { describe, expect, test } from "bun:test";
import { evaluateFreshness } from "./ScheduledRunFreshness";

describe("evaluateFreshness", () => {
  test("is fresh when age is below the threshold", () => {
    const result = evaluateFreshness({
      lastRunAt: new Date("2026-08-11T00:00:00.000Z"),
      now: new Date("2026-08-11T01:00:00.000Z"),
      thresholdMs: 2 * 60 * 60 * 1000,
    });

    expect(result.isFresh).toBe(true);
    expect(result.ageMs).toBe(60 * 60 * 1000);
  });

  test("is fresh at exactly the threshold boundary", () => {
    const result = evaluateFreshness({
      lastRunAt: new Date("2026-08-11T00:00:00.000Z"),
      now: new Date("2026-08-11T02:00:00.000Z"),
      thresholdMs: 2 * 60 * 60 * 1000,
    });

    expect(result.isFresh).toBe(true);
    expect(result.ageMs).toBe(2 * 60 * 60 * 1000);
  });

  test("is stale when age exceeds the threshold", () => {
    const result = evaluateFreshness({
      lastRunAt: new Date("2026-08-11T00:00:00.000Z"),
      now: new Date("2026-08-11T02:00:00.001Z"),
      thresholdMs: 2 * 60 * 60 * 1000,
    });

    expect(result.isFresh).toBe(false);
    expect(result.ageMs).toBe(2 * 60 * 60 * 1000 + 1);
  });

  test("treats a last run timestamp in the future as fresh (clock skew tolerance)", () => {
    const result = evaluateFreshness({
      lastRunAt: new Date("2026-08-11T02:00:00.000Z"),
      now: new Date("2026-08-11T00:00:00.000Z"),
      thresholdMs: 60 * 60 * 1000,
    });

    expect(result.isFresh).toBe(true);
    expect(result.ageMs).toBe(-2 * 60 * 60 * 1000);
  });
});
