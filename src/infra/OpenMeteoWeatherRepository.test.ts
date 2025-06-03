import { beforeEach, describe, expect, test } from "bun:test";
import { OpenMeteoWeatherRepository } from "./OpenMeteoWeatherRepository";

// Helper function to calculate expected datetime format for daily data
// Based on the implementation: noon JST (12:00) = 03:00 UTC
function getExpectedDailyDatetime(dateString: string): string {
  return `${dateString}T03:00:00Z`;
}

// Helper function to validate ISO datetime format
function isValidISODateTime(datetime: string): boolean {
  const isoDateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
  return isoDateTimeRegex.test(datetime);
}

// Simple integration tests without mocking
describe("OpenMeteoWeatherRepository", () => {
  let repository: OpenMeteoWeatherRepository;

  beforeEach(() => {
    repository = new OpenMeteoWeatherRepository();
  });

  describe("getWeather", () => {
    test("should return weather data with correct structure", async () => {
      // Use a known date that should have data
      const result = await repository.getWeather(
        35.6785, // Tokyo latitude
        139.6823, // Tokyo longitude
        "2025-06-01T12:00:00Z",
      );

      // Verify structure
      expect(result).toHaveProperty("datetime");
      expect(result).toHaveProperty("condition");
      expect(result).toHaveProperty("temperature");
      expect(result).toHaveProperty("windSpeed");
      expect(result).toHaveProperty("humidity");
      expect(result).toHaveProperty("visibility");
      expect(result).toHaveProperty("precipitationProbability");
      expect(result).toHaveProperty("uvIndex");

      // Verify types
      expect(typeof result.datetime).toBe("string");
      expect(typeof result.condition).toBe("string");
      expect(typeof result.temperature).toBe("number");
      expect(typeof result.windSpeed).toBe("number");
      expect(typeof result.humidity).toBe("number");
      expect(typeof result.visibility).toBe("number");
      expect(typeof result.precipitationProbability).toBe("number");
      expect(typeof result.uvIndex).toBe("number");

      // Verify datetime is preserved
      expect(result.datetime).toBe("2025-06-01T12:00:00Z");

      // Verify reasonable value ranges
      expect(result.temperature).toBeGreaterThan(-50);
      expect(result.temperature).toBeLessThan(60);
      expect(result.windSpeed).toBeGreaterThanOrEqual(0);
      expect(result.humidity).toBeGreaterThanOrEqual(0);
      expect(result.humidity).toBeLessThanOrEqual(100);
      expect(result.visibility).toBeGreaterThan(0);
      expect(result.precipitationProbability).toBeGreaterThanOrEqual(0);
      expect(result.precipitationProbability).toBeLessThanOrEqual(100);
      expect(result.uvIndex).toBeGreaterThanOrEqual(0);
    });

    test("should handle different weather conditions", async () => {
      const result = await repository.getWeather(
        35.6785,
        139.6823,
        "2025-06-02T12:00:00Z",
      );

      const validConditions = [
        "clear",
        "mostly_clear",
        "partly_cloudy",
        "overcast",
        "fog",
        "drizzle",
        "rain",
        "snow",
        "unknown",
      ];

      expect(validConditions).toContain(result.condition);
    });
  });

  describe("getWeatherBatch", () => {
    test("should return batch weather data with correct structure", async () => {
      const result = await repository.getWeatherBatch(
        35.6785,
        139.6823,
        "2025-06-01",
        "2025-06-03",
      );

      // Should return 3 days of data
      expect(result).toHaveLength(3);        // Check each day's data structure
        result.forEach((weather, _index) => {
          expect(weather).toHaveProperty("datetime");
          expect(weather).toHaveProperty("condition");
          expect(weather).toHaveProperty("temperature");
          expect(weather).toHaveProperty("windSpeed");
          expect(weather).toHaveProperty("humidity");
          expect(weather).toHaveProperty("visibility");
          expect(weather).toHaveProperty("precipitationProbability");
          expect(weather).toHaveProperty("uvIndex");

          // Verify datetime format for batch requests - should be valid ISO format
          expect(isValidISODateTime(weather.datetime)).toBe(true);

          // Verify visibility is set to default value for daily data
          expect(weather.visibility).toBe(20);

          // Verify reasonable value ranges
          expect(weather.temperature).toBeGreaterThan(-50);
          expect(weather.temperature).toBeLessThan(60);
          expect(weather.windSpeed).toBeGreaterThanOrEqual(0);
          expect(weather.humidity).toBeGreaterThanOrEqual(0);
          expect(weather.humidity).toBeLessThanOrEqual(100);
          expect(weather.precipitationProbability).toBeGreaterThanOrEqual(0);
          expect(weather.precipitationProbability).toBeLessThanOrEqual(100);
          expect(weather.uvIndex).toBeGreaterThanOrEqual(0);
        });

        // Verify correct date sequence using dynamic calculation
        expect(result[0].datetime).toBe(getExpectedDailyDatetime("2025-06-01"));
        expect(result[1].datetime).toBe(getExpectedDailyDatetime("2025-06-02"));
        expect(result[2].datetime).toBe(getExpectedDailyDatetime("2025-06-03"));
    });
  });

  describe("consistency between single and batch requests", () => {
    test("should return consistent data structure", async () => {
      // Get single day data
      const singleResult = await repository.getWeather(
        35.6785,
        139.6823,
        "2025-06-01T12:00:00Z",
      );

      // Get same day in batch
      const batchResult = await repository.getWeatherBatch(
        35.6785,
        139.6823,
        "2025-06-01",
        "2025-06-01",
      );

      // Should have same structure
      expect(typeof singleResult.condition).toBe(
        typeof batchResult[0].condition,
      );
      expect(typeof singleResult.temperature).toBe(
        typeof batchResult[0].temperature,
      );
      expect(typeof singleResult.windSpeed).toBe(
        typeof batchResult[0].windSpeed,
      );
      expect(typeof singleResult.humidity).toBe(typeof batchResult[0].humidity);
      expect(typeof singleResult.visibility).toBe(
        typeof batchResult[0].visibility,
      );
      expect(typeof singleResult.precipitationProbability).toBe(
        typeof batchResult[0].precipitationProbability,
      );
      expect(typeof singleResult.uvIndex).toBe(typeof batchResult[0].uvIndex);

      // Both should use daily data, so values should be the same
      expect(singleResult.condition).toBe(batchResult[0].condition);
      expect(singleResult.temperature).toBe(batchResult[0].temperature);
      expect(singleResult.windSpeed).toBe(batchResult[0].windSpeed);
      expect(singleResult.humidity).toBe(batchResult[0].humidity);
      expect(singleResult.visibility).toBe(batchResult[0].visibility);
      expect(singleResult.precipitationProbability).toBe(
        batchResult[0].precipitationProbability,
      );
      expect(singleResult.uvIndex).toBe(batchResult[0].uvIndex);

      // Verify batch result uses the expected datetime format
      expect(batchResult[0].datetime).toBe(getExpectedDailyDatetime("2025-06-01"));
    });
  });

  describe("weather code mapping", () => {
    test("should map weather codes correctly", async () => {
      // This test verifies that the mapWeatherCode function works
      // We can't directly test it since it's not exported, but we can verify
      // that the API returns valid conditions
      const result = await repository.getWeather(
        35.6785,
        139.6823,
        "2025-06-01T12:00:00Z",
      );

      const validConditions = [
        "clear", // code 0
        "mostly_clear", // code 1
        "partly_cloudy", // code 2
        "overcast", // code 3
        "fog", // codes 45, 48
        "drizzle", // codes 51, 53, 55, 56, 57
        "rain", // codes 61, 63, 65, 80, 81, 82
        "snow", // codes 71, 73, 75, 77, 85, 86
        "unknown", // fallback
      ];

      expect(validConditions).toContain(result.condition);
    });
  });

  describe("datetime format validation", () => {
    test("should generate consistent datetime format for daily data", async () => {
      const testDate = "2025-06-15";
      const expectedDateTime = getExpectedDailyDatetime(testDate);

      // Verify the helper function generates the expected format
      expect(expectedDateTime).toBe(`${testDate}T03:00:00Z`);
      expect(isValidISODateTime(expectedDateTime)).toBe(true);

      // Verify batch result matches expected format
      const batchResult = await repository.getWeatherBatch(
        35.6785,
        139.6823,
        testDate,
        testDate,
      );

      expect(batchResult).toHaveLength(1);
      expect(batchResult[0].datetime).toBe(expectedDateTime);
    });

    test("should handle multiple consecutive dates correctly", async () => {
      const startDate = "2025-06-10";
      const endDate = "2025-06-12";

      const result = await repository.getWeatherBatch(
        35.6785,
        139.6823,
        startDate,
        endDate,
      );

      expect(result).toHaveLength(3);

      // Verify each date follows the expected pattern
      const expectedDates = ["2025-06-10", "2025-06-11", "2025-06-12"];
      result.forEach((weather, index) => {
        const expectedDateTime = getExpectedDailyDatetime(expectedDates[index]);
        expect(weather.datetime).toBe(expectedDateTime);
        expect(isValidISODateTime(weather.datetime)).toBe(true);
      });
    });
  });
});
