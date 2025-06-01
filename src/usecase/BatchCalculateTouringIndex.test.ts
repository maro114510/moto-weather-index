import { describe, test, expect, beforeEach, mock } from "bun:test";
import { BatchCalculateTouringIndexUsecase, type Prefecture, type TouringIndexRepository, type WeatherRepository } from "./BatchCalculateTouringIndex";
import type { Weather } from "../domain/Weather";

describe("BatchCalculateTouringIndexUsecase", () => {
  let mockWeatherRepository: WeatherRepository;
  let mockTouringIndexRepository: TouringIndexRepository;
  let usecase: BatchCalculateTouringIndexUsecase;

  beforeEach(() => {
    // Create fresh mock implementations for each test
    mockWeatherRepository = {
      getWeather: mock(async (lat: number, lon: number, datetime: string): Promise<Weather> => {
        return {
          datetime,
          condition: "clear",
          temperature: 21.5,
          windSpeed: 2.5,
          humidity: 50,
          visibility: 20,
          precipitationProbability: 0,
          uvIndex: 3,
          airQuality: "low"
        };
      })
    };

    mockTouringIndexRepository = {
      upsertTouringIndex: mock(async () => {}),
      getAllPrefectures: mock(async (): Promise<Prefecture[]> => {
        return [
          { id: 1, name_ja: "北海道", name_en: "Hokkaido", latitude: 43.0642, longitude: 141.3468 },
          { id: 13, name_ja: "東京都", name_en: "Tokyo", latitude: 35.6895, longitude: 139.6917 }
        ];
      })
    };

    // Create fresh usecase instance
    usecase = new BatchCalculateTouringIndexUsecase(
      mockWeatherRepository,
      mockTouringIndexRepository
    );
  });

  describe("generateTargetDates", () => {
    test("should generate correct number of dates", () => {
      const dates = BatchCalculateTouringIndexUsecase.generateTargetDates(3);
      expect(dates).toHaveLength(3);
    });

    test("should generate dates in YYYY-MM-DD format", () => {
      const dates = BatchCalculateTouringIndexUsecase.generateTargetDates(1);
      expect(dates[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test("should include today as first date", () => {
      const dates = BatchCalculateTouringIndexUsecase.generateTargetDates(1);
      const today = new Date().toISOString().split('T')[0];
      expect(dates[0]).toBe(today);
    });

    test("should generate consecutive dates", () => {
      const dates = BatchCalculateTouringIndexUsecase.generateTargetDates(3);

      const date1 = new Date(dates[0]);
      const date2 = new Date(dates[1]);
      const date3 = new Date(dates[2]);

      // Check that dates are consecutive
      expect(date2.getTime() - date1.getTime()).toBe(24 * 60 * 60 * 1000); // 1 day in ms
      expect(date3.getTime() - date2.getTime()).toBe(24 * 60 * 60 * 1000);
    });

    test("should default to 7 days", () => {
      const dates = BatchCalculateTouringIndexUsecase.generateTargetDates();
      expect(dates).toHaveLength(7);
    });
  });

  describe("execute", () => {
    test("should process all prefectures for all target dates", async () => {
      const targetDates = ["2025-06-01", "2025-06-02"];

      const result = await usecase.execute(targetDates, 1);

      // Should process 2 prefectures × 2 dates = 4 total
      expect(result.total_processed).toBe(4);
      expect(result.successful_inserts).toBe(4);
      expect(result.failed_inserts).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Verify weather API was called correctly
      expect(mockWeatherRepository.getWeather).toHaveBeenCalledTimes(4);

      // Verify database upsert was called correctly
      expect(mockTouringIndexRepository.upsertTouringIndex).toHaveBeenCalledTimes(4);
    });

    test("should call weather API with correct parameters", async () => {
      const targetDates = ["2025-06-01"];

      await usecase.execute(targetDates, 1);

      // Check first prefecture (Hokkaido)
      expect(mockWeatherRepository.getWeather).toHaveBeenCalledWith(
        43.0642, // Hokkaido latitude
        141.3468, // Hokkaido longitude
        "2025-06-01T03:00:00Z" // 12:00 JST = 03:00 UTC
      );

      // Check second prefecture (Tokyo)
      expect(mockWeatherRepository.getWeather).toHaveBeenCalledWith(
        35.6895, // Tokyo latitude
        139.6917, // Tokyo longitude
        "2025-06-01T03:00:00Z"
      );
    });

    test("should call database upsert with correct data structure", async () => {
      const targetDates = ["2025-06-01"];

      await usecase.execute(targetDates, 1);

      // Verify upsert was called with correct structure
      const upsertCalls = (mockTouringIndexRepository.upsertTouringIndex as any).mock.calls;
      expect(upsertCalls).toHaveLength(2);

      // Check first call (Hokkaido)
      const firstCall = upsertCalls[0][0];
      expect(firstCall).toMatchObject({
        prefecture_id: 1,
        date: "2025-06-01",
        score: 100, // Perfect weather should give max score
      });

      // Check that weather_factors_json and weather_raw_json are strings
      expect(typeof firstCall.weather_factors_json).toBe("string");
      expect(typeof firstCall.weather_raw_json).toBe("string");

      // Verify JSON strings are valid and contain expected content
      const weatherFactors = JSON.parse(firstCall.weather_factors_json);
      const weatherRaw = JSON.parse(firstCall.weather_raw_json);

      expect(weatherFactors).toHaveProperty("weather");
      expect(weatherFactors).toHaveProperty("temperature");
      expect(weatherRaw).toHaveProperty("datetime");
      expect(weatherRaw).toHaveProperty("condition");
    });

    test("should handle weather API errors gracefully", async () => {
      // Create new mock that throws error for Tokyo
      const weatherMock = mock(async (lat: number, lon: number, datetime: string) => {
        if (lat === 35.6895) { // Tokyo
          throw new Error("Weather API failed");
        }
        return {
          datetime,
          condition: "clear",
          temperature: 21.5,
          windSpeed: 2.5,
          humidity: 50,
          visibility: 20,
          precipitationProbability: 0,
          uvIndex: 3,
          airQuality: "low"
        } as Weather;
      });

      // Replace the mock
      mockWeatherRepository.getWeather = weatherMock;

      const targetDates = ["2025-06-01"];
      const result = await usecase.execute(targetDates, 1);

      expect(result.total_processed).toBe(2);
      expect(result.successful_inserts).toBe(1); // Only Hokkaido succeeded
      expect(result.failed_inserts).toBe(1); // Tokyo failed
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        prefecture_id: 13, // Tokyo
        date: "2025-06-01",
        error: expect.stringContaining("Weather API failed")
      });
    });

    test("should handle database errors gracefully", async () => {
      // Create new mock that throws error for second upsert
      let callCount = 0;
      const upsertMock = mock(async () => {
        callCount++;
        if (callCount === 2) {
          throw new Error("Database connection failed");
        }
      });

      // Replace the mock
      mockTouringIndexRepository.upsertTouringIndex = upsertMock;

      const targetDates = ["2025-06-01"];
      const result = await usecase.execute(targetDates, 1);

      expect(result.total_processed).toBe(2);
      expect(result.successful_inserts).toBe(1);
      expect(result.failed_inserts).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain("Database connection failed");
    });

    test("should retry failed operations", async () => {
      // Create new mock that fails first 2 attempts, then succeeds
      let attemptCount = 0;
      const weatherMock = mock(async () => {
        attemptCount++;
        if (attemptCount <= 2) {
          throw new Error("Temporary failure");
        }
        return {
          datetime: "2025-06-01T03:00:00Z",
          condition: "clear",
          temperature: 21.5,
          windSpeed: 2.5,
          humidity: 50,
          visibility: 20,
          precipitationProbability: 0,
          uvIndex: 3,
          airQuality: "low"
        } as Weather;
      });

      // Replace the mock
      mockWeatherRepository.getWeather = weatherMock;

      const targetDates = ["2025-06-01"];
      const result = await usecase.execute(targetDates, 3); // Allow 3 retries

      // Should eventually succeed after retries
      expect(result.successful_inserts).toBe(2);
      expect(result.failed_inserts).toBe(0);

      // Should have been called multiple times due to retries
      expect(mockWeatherRepository.getWeather).toHaveBeenCalled();
    });
  });
});
