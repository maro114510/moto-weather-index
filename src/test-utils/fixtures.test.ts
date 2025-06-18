// src/test-utils/fixtures.test.ts

import { describe, expect, test } from "bun:test";
import {
  ApiResponseFixture,
  DateFixture,
  PerformanceFixture,
  PrefectureFixture,
  TouringIndexBatchItemFixture,
  WeatherFixture,
} from "./fixtures";

describe("Test Fixtures", () => {
  describe("WeatherFixture", () => {
    test("should create perfect weather", () => {
      const weather = WeatherFixture.perfect();

      expect(weather.condition).toBe("clear");
      expect(weather.temperature).toBe(21.5);
      expect(weather.windSpeed).toBe(2.5);
      expect(weather.humidity).toBe(50);
      expect(weather.visibility).toBe(20);
      expect(weather.precipitationProbability).toBe(0);
      expect(weather.uvIndex).toBe(3);
      expect(weather.airQuality).toBe("low");
    });

    test("should create worst weather", () => {
      const weather = WeatherFixture.worst();

      expect(weather.condition).toBe("snow");
      expect(weather.temperature).toBe(-50);
      expect(weather.windSpeed).toBe(50);
      expect(weather.humidity).toBe(100);
      expect(weather.visibility).toBe(0);
      expect(weather.precipitationProbability).toBe(100);
      expect(weather.uvIndex).toBe(20);
      expect(weather.airQuality).toBe("high");
    });

    test("should create weather with overrides", () => {
      const weather = WeatherFixture.create({
        temperature: 30,
        windSpeed: 5,
      });

      expect(weather.temperature).toBe(30);
      expect(weather.windSpeed).toBe(5);
      expect(weather.condition).toBe("clear"); // Default from perfect
    });

    test("should create weather with specific properties", () => {
      expect(WeatherFixture.withTemperature(25).temperature).toBe(25);
      expect(WeatherFixture.withWindSpeed(7).windSpeed).toBe(7);
      expect(WeatherFixture.withHumidity(80).humidity).toBe(80);
      expect(WeatherFixture.withVisibility(5).visibility).toBe(5);
      expect(
        WeatherFixture.withPrecipitationProbability(50)
          .precipitationProbability,
      ).toBe(50);
      expect(WeatherFixture.withUvIndex(10).uvIndex).toBe(10);
      expect(WeatherFixture.withAirQuality("medium").airQuality).toBe("medium");
      expect(WeatherFixture.withCondition("rain").condition).toBe("rain");
    });
  });

  describe("PrefectureFixture", () => {
    test("should create Tokyo prefecture", () => {
      const tokyo = PrefectureFixture.tokyo();

      expect(tokyo.id).toBe(13);
      expect(tokyo.name_ja).toBe("東京都");
      expect(tokyo.name_en).toBe("Tokyo");
      expect(tokyo.latitude).toBe(35.6762);
      expect(tokyo.longitude).toBe(139.6503);
    });

    test("should create Osaka prefecture", () => {
      const osaka = PrefectureFixture.osaka();

      expect(osaka.id).toBe(27);
      expect(osaka.name_en).toBe("Osaka");
    });

    test("should create prefecture list", () => {
      const list = PrefectureFixture.list();

      expect(list).toHaveLength(3);
      expect(list[0].name_en).toBe("Tokyo");
      expect(list[1].name_en).toBe("Kanagawa");
      expect(list[2].name_en).toBe("Osaka");
    });

    test("should create prefecture with overrides", () => {
      const custom = PrefectureFixture.create({
        id: 99,
        name_en: "Custom",
      });

      expect(custom.id).toBe(99);
      expect(custom.name_en).toBe("Custom");
      expect(custom.name_ja).toBe("東京都"); // Default from Tokyo
    });
  });

  describe("TouringIndexBatchItemFixture", () => {
    test("should create standard batch item", () => {
      const item = TouringIndexBatchItemFixture.create();

      expect(item.prefecture_id).toBe(13);
      expect(item.date).toBe("2025-06-01");
      expect(item.score).toBe(100);
      expect(() => JSON.parse(item.weather_factors_json)).not.toThrow();
      expect(() => JSON.parse(item.weather_raw_json)).not.toThrow();
    });

    test("should create batch item with overrides", () => {
      const item = TouringIndexBatchItemFixture.create({
        prefecture_id: 27,
        score: 75,
      });

      expect(item.prefecture_id).toBe(27);
      expect(item.score).toBe(75);
    });

    test("should create multiple batch items", () => {
      const items = TouringIndexBatchItemFixture.createMultiple(
        13,
        "2025-06-01",
        3,
      );

      expect(items).toHaveLength(3);
      expect(items[0].prefecture_id).toBe(13);
      expect(items[0].date).toBe("2025-06-01");
      expect(items[1].date).toBe("2025-06-02");
      expect(items[2].date).toBe("2025-06-03");
    });
  });

  describe("DateFixture", () => {
    test("should generate today's date", () => {
      const today = DateFixture.today();
      const expected = new Date().toISOString().split("T")[0];

      expect(today).toBe(expected);
    });

    test("should generate dates relative to today", () => {
      const yesterday = DateFixture.yesterday();
      const tomorrow = DateFixture.tomorrow();

      expect(yesterday).toBe(DateFixture.daysFromToday(-1));
      expect(tomorrow).toBe(DateFixture.daysFromToday(1));
    });

    test("should generate date ranges", () => {
      const range = DateFixture.range(-7, 7);

      expect(range.startDate).toBe(DateFixture.daysFromToday(-7));
      expect(range.endDate).toBe(DateFixture.daysFromToday(7));
    });

    test("should generate ISO datetime", () => {
      const datetime = DateFixture.isoDateTime("2025-06-01");

      expect(datetime).toBe("2025-06-01T12:00:00Z");
    });
  });

  describe("ApiResponseFixture", () => {
    test("should create touring index history", () => {
      const history = ApiResponseFixture.touringIndexHistory(13, [
        "2025-06-01",
        "2025-06-02",
      ]);

      expect(history).toHaveLength(2);
      expect(history[0].prefecture_id).toBe(13);
      expect(history[0].date).toBe("2025-06-01");
      expect(history[1].date).toBe("2025-06-02");
      expect(history[0].score).toBeGreaterThanOrEqual(80);
      expect(history[0].score).toBeLessThanOrEqual(100);
    });

    test("should create error response", () => {
      const error = ApiResponseFixture.error("Test error", 400);

      expect(error.error).toBe("Test error");
      expect(error.requestId).toBe("test-request-id");
    });

    test("should create validation error", () => {
      const error = ApiResponseFixture.validationError(
        "lat",
        "Invalid latitude",
      );

      expect(error.error).toBe("Invalid parameters");
      expect(error.details).toEqual(["lat: Invalid latitude"]);
    });
  });

  describe("PerformanceFixture", () => {
    test("should measure execution time", async () => {
      const result = await PerformanceFixture.measureTime(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "test result";
      });

      expect(result.result).toBe("test result");
      expect(result.duration).toBeGreaterThan(8); // At least ~10ms
      expect(result.duration).toBeLessThan(100); // But not too much overhead
    });

    test("should measure average time", async () => {
      const result = await PerformanceFixture.measureAverageTime(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return Math.random();
      }, 3);

      expect(result.results).toHaveLength(3);
      expect(result.averageDuration).toBeGreaterThan(3);
      expect(result.averageDuration).toBeLessThan(50);
    });

    test("should provide benchmark thresholds", () => {
      const benchmarks = PerformanceFixture.benchmarks();

      expect(benchmarks.FAST).toBe(100);
      expect(benchmarks.NORMAL).toBe(500);
      expect(benchmarks.SLOW).toBe(2000);
    });
  });
});
