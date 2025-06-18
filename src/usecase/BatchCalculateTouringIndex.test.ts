import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Weather } from "../domain/Weather";
import {
  BatchCalculateTouringIndexUsecase,
  type Prefecture,
  type TouringIndexRepository,
  type WeatherRepository,
} from "./BatchCalculateTouringIndex";

describe("BatchCalculateTouringIndexUsecase", () => {
  let mockWeatherRepository: WeatherRepository;
  let mockTouringIndexRepository: TouringIndexRepository;
  let usecase: BatchCalculateTouringIndexUsecase;

  beforeEach(() => {
    // Create fresh mock implementations for each test
    mockWeatherRepository = {
      getWeather: mock(
        async (
          _lat: number,
          _lon: number,
          datetime: string,
        ): Promise<Weather> => {
          return {
            datetime,
            condition: "clear",
            temperature: 21.5,
            windSpeed: 2.5,
            humidity: 50,
            visibility: 20,
            precipitationProbability: 0,
            uvIndex: 3,
            airQuality: "low",
          };
        },
      ),
      getWeatherBatch: mock(
        async (
          _lat: number,
          _lon: number,
          startDate: string,
          endDate: string,
        ): Promise<Weather[]> => {
          // Generate weather data for date range
          const start = new Date(startDate);
          const end = new Date(endDate);
          const weatherData: Weather[] = [];

          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateString = d.toISOString().split("T")[0];
            weatherData.push({
              datetime: `${dateString}T03:00:00Z`,
              condition: "clear",
              temperature: 21.5,
              windSpeed: 2.5,
              humidity: 50,
              visibility: 20,
              precipitationProbability: 0,
              uvIndex: 3,
              airQuality: "low",
            });
          }

          return weatherData;
        },
      ),
    };

    mockTouringIndexRepository = {
      upsertTouringIndex: mock(async () => {}),
      getAllPrefectures: mock(async (): Promise<Prefecture[]> => {
        return [
          {
            id: 1,
            name_ja: "北海道",
            name_en: "Hokkaido",
            latitude: 43.0642,
            longitude: 141.3468,
          },
          {
            id: 13,
            name_ja: "東京都",
            name_en: "Tokyo",
            latitude: 35.6895,
            longitude: 139.6917,
          },
        ];
      }),
    };

    // Create fresh usecase instance
    usecase = new BatchCalculateTouringIndexUsecase(
      mockWeatherRepository,
      mockTouringIndexRepository,
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
      const today = new Date().toISOString().split("T")[0];
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

    test("should default to 16 days", () => {
      const dates = BatchCalculateTouringIndexUsecase.generateTargetDates();
      expect(dates).toHaveLength(16);
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

      // Verify batch weather API was called correctly (once per prefecture)
      expect(mockWeatherRepository.getWeatherBatch).toHaveBeenCalledTimes(2);

      // Verify database upsert was called correctly (once per prefecture-date combination)
      expect(
        mockTouringIndexRepository.upsertTouringIndex,
      ).toHaveBeenCalledTimes(4);
    });

    test("should call batch weather API with correct parameters", async () => {
      const targetDates = ["2025-06-01", "2025-06-02"];

      await usecase.execute(targetDates, 1);

      // Check first prefecture (Hokkaido) - batch call
      expect(mockWeatherRepository.getWeatherBatch).toHaveBeenCalledWith(
        43.0642, // Hokkaido latitude
        141.3468, // Hokkaido longitude
        "2025-06-01", // Start date
        "2025-06-02", // End date
      );

      // Check second prefecture (Tokyo) - batch call
      expect(mockWeatherRepository.getWeatherBatch).toHaveBeenCalledWith(
        35.6895, // Tokyo latitude
        139.6917, // Tokyo longitude
        "2025-06-01", // Start date
        "2025-06-02", // End date
      );
    });

    test("should call database upsert with correct data structure", async () => {
      const targetDates = ["2025-06-01"];

      await usecase.execute(targetDates, 1);

      // Verify upsert was called with correct structure
      const upsertCalls = (mockTouringIndexRepository.upsertTouringIndex as any)
        .mock.calls;
      expect(upsertCalls).toHaveLength(2);

      // Check first call (Hokkaido)
      const firstCall = upsertCalls[0][0];
      expect(firstCall).toMatchObject({
        prefecture_id: 1,
        date: "2025-06-01",
        score: 100, // Perfect weather should give max score (30+20+15+10+5+10+5+5 = 100)
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
      // Create new mock that throws error for Tokyo batch call
      const batchWeatherMock = mock(
        async (
          lat: number,
          _lon: number,
          _startDate: string,
          _endDate: string,
        ) => {
          if (lat === 35.6895) {
            // Tokyo
            throw new Error("Weather API failed");
          }
          // Return data for Hokkaido
          return [
            {
              datetime: "2025-06-01T03:00:00Z",
              condition: "clear",
              temperature: 21.5,
              windSpeed: 2.5,
              humidity: 50,
              visibility: 20,
              precipitationProbability: 0,
              uvIndex: 3,
              airQuality: "low",
            },
          ] as Weather[];
        },
      );

      // Replace the mock
      mockWeatherRepository.getWeatherBatch = batchWeatherMock;

      const targetDates = ["2025-06-01"];
      const result = await usecase.execute(targetDates, 1);

      expect(result.total_processed).toBe(2);
      expect(result.successful_inserts).toBe(1); // Only Hokkaido succeeded
      expect(result.failed_inserts).toBe(1); // Tokyo failed
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        prefecture_id: 13, // Tokyo
        date: "2025-06-01",
        error: expect.stringContaining("Weather API failed"),
      });
    });

    test("should handle database errors gracefully", async () => {
      // Create new mock that throws error for second prefecture's first date
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
      // Create new mock that fails first 2 batch attempts, then succeeds
      let attemptCount = 0;
      const batchWeatherMock = mock(async () => {
        attemptCount++;
        if (attemptCount <= 2) {
          throw new Error("Temporary failure");
        }
        return [
          {
            datetime: "2025-06-01T03:00:00Z",
            condition: "clear",
            temperature: 21.5,
            windSpeed: 2.5,
            humidity: 50,
            visibility: 20,
            precipitationProbability: 0,
            uvIndex: 3,
            airQuality: "low",
          },
        ] as Weather[];
      });

      // Replace the mock
      mockWeatherRepository.getWeatherBatch = batchWeatherMock;

      const targetDates = ["2025-06-01"];
      const result = await usecase.execute(targetDates, 3); // Allow 3 retries

      // Should eventually succeed after retries
      expect(result.successful_inserts).toBe(2);
      expect(result.failed_inserts).toBe(0);

      // Should have been called multiple times due to retries
      expect(mockWeatherRepository.getWeatherBatch).toHaveBeenCalled();
    });
  });

  describe("generateTargetDatesFromStart", () => {
    test("should generate correct dates from custom start date", () => {
      // Mock Date to make "2025-06-10" within 7 days
      const originalDate = Date;
      const mockDate = new Date("2025-06-15T00:00:00.000Z");
      global.Date = class extends Date {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(mockDate);
          } else {
            super(...args);
          }
        }
        static now() {
          return mockDate.getTime();
        }
      } as any;

      try {
        const startDate = "2025-06-10";
        const days = 5;

        const dates =
          BatchCalculateTouringIndexUsecase.generateTargetDatesFromStart(
            startDate,
            days,
          );

        expect(dates).toHaveLength(5);
        expect(dates[0]).toBe("2025-06-10");
        expect(dates[1]).toBe("2025-06-11");
        expect(dates[2]).toBe("2025-06-12");
        expect(dates[3]).toBe("2025-06-13");
        expect(dates[4]).toBe("2025-06-14");
      } finally {
        global.Date = originalDate;
      }
    });

    test("should use default 16 days when days parameter not provided", () => {
      // Mock Date to make "2025-06-10" within 7 days
      const originalDate = Date;
      const mockDate = new Date("2025-06-15T00:00:00.000Z");
      global.Date = class extends Date {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(mockDate);
          } else {
            super(...args);
          }
        }
        static now() {
          return mockDate.getTime();
        }
      } as any;

      try {
        const startDate = "2025-06-10";

        const dates =
          BatchCalculateTouringIndexUsecase.generateTargetDatesFromStart(
            startDate,
          );

        expect(dates).toHaveLength(16);
        expect(dates[0]).toBe("2025-06-10");
        expect(dates[15]).toBe("2025-06-25");
      } finally {
        global.Date = originalDate;
      }
    });

    test("should validate start date and throw error for invalid date", () => {
      const invalidStartDate = "2025-01-01"; // Too far in the past

      expect(() => {
        BatchCalculateTouringIndexUsecase.generateTargetDatesFromStart(
          invalidStartDate,
        );
      }).toThrow("Batch start date must be within the last 7 days");
    });

    test("should work with date within last 7 days", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 3); // 3 days ago
      const startDate = pastDate.toISOString().split("T")[0];

      const dates =
        BatchCalculateTouringIndexUsecase.generateTargetDatesFromStart(
          startDate,
          3,
        );

      expect(dates).toHaveLength(3);
      expect(dates[0]).toBe(startDate);
    });
  });
});
