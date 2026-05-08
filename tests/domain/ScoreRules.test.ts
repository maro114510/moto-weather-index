import { describe, expect, test } from "bun:test";
import { weatherScore } from "../../src/domain/ScoreRules";

describe("weatherScore", () => {
  test("clear returns 30", () => {
    expect(weatherScore("clear")).toBe(30);
  });

  test("mostly_clear returns 28", () => {
    expect(weatherScore("mostly_clear")).toBe(28);
  });

  test("partly_cloudy returns 23", () => {
    expect(weatherScore("partly_cloudy")).toBe(23);
  });

  test("cloudy returns 15", () => {
    expect(weatherScore("cloudy")).toBe(15);
  });

  test("overcast returns 12", () => {
    expect(weatherScore("overcast")).toBe(12);
  });

  test("drizzle returns 8", () => {
    expect(weatherScore("drizzle")).toBe(8);
  });

  test("fog returns 5", () => {
    expect(weatherScore("fog")).toBe(5);
  });

  test("rain returns 0", () => {
    expect(weatherScore("rain")).toBe(0);
  });

  test("snow returns 0", () => {
    expect(weatherScore("snow")).toBe(0);
  });

  test("unknown returns 10 (fallback)", () => {
    expect(weatherScore("unknown")).toBe(10);
  });

  test("drizzle scores higher than fog and lower than overcast", () => {
    expect(weatherScore("drizzle")).toBeGreaterThan(weatherScore("fog"));
    expect(weatherScore("drizzle")).toBeLessThan(weatherScore("overcast"));
  });
});
