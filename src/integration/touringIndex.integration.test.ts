// src/integration/touringIndex.integration.test.ts

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { calculateTouringIndex } from "../usecase/CalculateTouringIndex";
import { BatchCalculateTouringIndexUsecase } from "../usecase/BatchCalculateTouringIndex";
import {
  WeatherFixture,
  PrefectureFixture,
  DateFixture,
  TouringIndexBatchItemFixture,
} from "../test-utils/fixtures";
import {
  RepositoryMockFactory,
  MockScenarioFactory,
  ContextMockFactory,
  ResponseAssertions,
} from "../test-utils/mocks";
import {
  PerformanceTester,
  MemoryTester,
  LoadTester,
  PERFORMANCE_THRESHOLDS,
} from "../test-utils/performance";
import { getTouringIndexHistory } from "../interface/handlers/touringIndexHandler";

describe("Touring Index Integration Tests", () => {
  describe("End-to-End Weather Processing", () => {
    test("should process weather data through complete calculation pipeline", async () => {
      // Test the complete flow from weather input to touring score
      const weather = WeatherFixture.perfect();
      
      const result = await PerformanceTester.measureAsync(async () => {
        return calculateTouringIndex(weather);
      });

      // Verify the calculation is fast
      expect(result.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST);
      
      // Verify the result structure
      expect(result.result.score).toBe(100);
      expect(result.result.breakdown).toEqual({
        weather: 30,
        temperature: 20,
        wind: 15,
        humidity: 10,
        visibility: 5,
        precipitationProbability: 10,
        uvIndex: 5,
        airQuality: 5,
      });
    });

    test("should handle various weather conditions consistently", async () => {
      const weatherConditions = [
        WeatherFixture.perfect(),
        WeatherFixture.worst(),
        WeatherFixture.withCondition("cloudy"),
        WeatherFixture.withTemperature(15),
        WeatherFixture.withWindSpeed(8),
      ];

      const results = await Promise.all(
        weatherConditions.map(weather => 
          PerformanceTester.measureAsync(async () => calculateTouringIndex(weather))
        )
      );

      // All calculations should be fast
      results.forEach(result => {
        expect(result.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST);
        expect(result.result.score).toBeGreaterThanOrEqual(0);
        expect(result.result.score).toBeLessThanOrEqual(100);
      });

      // Verify score ordering (perfect > cloudy > worst)
      expect(results[0].result.score).toBeGreaterThan(results[1].result.score);
      expect(results[2].result.score).toBeGreaterThan(results[1].result.score);
    });
  });

  describe("Batch Processing Integration", () => {
    let weatherRepo: any;
    let touringIndexRepo: any;
    let batchUsecase: BatchCalculateTouringIndexUsecase;

    beforeEach(() => {
      weatherRepo = RepositoryMockFactory.weather();
      touringIndexRepo = RepositoryMockFactory.touringIndex();
      batchUsecase = new BatchCalculateTouringIndexUsecase(weatherRepo, touringIndexRepo);
    });

    test("should process batch data efficiently", async () => {
      // Setup test data
      const prefectures = PrefectureFixture.list();
      const targetDates = [
        DateFixture.today(),
        DateFixture.tomorrow(),
        DateFixture.daysFromToday(2),
      ];

      MockScenarioFactory.successfulBatchProcessing(weatherRepo, touringIndexRepo, prefectures);

      // Measure batch processing performance
      const result = await PerformanceTester.measureAsync(async () => {
        return batchUsecase.execute(targetDates, 1);
      });

      // Verify performance is reasonable for batch operation
      expect(result.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SLOW);
      
      // Verify all data was processed
      expect(result.result.total_processed).toBe(prefectures.length * targetDates.length);
      expect(result.result.successful_inserts).toBe(result.result.total_processed);
      expect(result.result.failed_inserts).toBe(0);
    });

    test("should handle batch processing under load", async () => {
      const prefectures = PrefectureFixture.list();
      const targetDates = [DateFixture.today()];

      MockScenarioFactory.successfulBatchProcessing(weatherRepo, touringIndexRepo, prefectures);

      // Run load test
      const loadResult = await LoadTester.loadTest(
        async () => batchUsecase.execute(targetDates, 1),
        3, // concurrency
        10 // total requests
      );

      // Verify load test results
      expect(loadResult.successRate).toBeGreaterThanOrEqual(0.9);
      expect(loadResult.averageDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.SLOW);
      expect(loadResult.errors.length).toBeLessThan(2);
    });

    test("should recover from partial failures gracefully", async () => {
      const prefectures = PrefectureFixture.list();
      const targetDates = [DateFixture.today()];

      // Setup scenario where some operations fail
      touringIndexRepo.getAllPrefectures.mockResolvedValue(prefectures);
      weatherRepo.getWeatherBatch
        .mockResolvedValueOnce([WeatherFixture.perfect()]) // First call succeeds
        .mockRejectedValueOnce(new Error("Weather API failed")) // Second call fails
        .mockResolvedValueOnce([WeatherFixture.perfect()]); // Third call succeeds

      const result = await batchUsecase.execute(targetDates, 1);

      // Verify partial success handling
      expect(result.total_processed).toBe(prefectures.length * targetDates.length);
      expect(result.successful_inserts).toBeGreaterThan(0);
      expect(result.failed_inserts).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("API Handler Integration", () => {
    let touringIndexRepo: any;

    beforeEach(() => {
      touringIndexRepo = RepositoryMockFactory.touringIndex();
      mock.module("../../di/container", () => ({
        createTouringIndexRepository: mock().mockReturnValue(touringIndexRepo),
      }));
    });

    test("should handle complete API request flow", async () => {
      // Setup test data
      const prefectures = PrefectureFixture.list();
      const historyDates = [
        DateFixture.daysFromToday(-5),
        DateFixture.daysFromToday(-3),
        DateFixture.daysFromToday(-1),
      ];

      MockScenarioFactory.successfulPrefectureLookup(touringIndexRepo, prefectures);
      MockScenarioFactory.successfulHistoryData(touringIndexRepo, 13, historyDates);

      // Create context with valid query parameters
      const context = ContextMockFactory.withQuery({
        lat: "35.6762",
        lon: "139.6503",
        startDate: DateFixture.daysFromToday(-7),
        endDate: DateFixture.today(),
      });

      // Mock validation functions
      const mockValidateDateRange = mock();
      const mockFindNearestPrefecture = mock().mockReturnValue(prefectures[0]);
      const mockGetTouringIndexHistorySchema = {
        parse: mock().mockReturnValue({
          lat: 35.6762,
          lon: 139.6503,
          startDate: DateFixture.daysFromToday(-7),
          endDate: DateFixture.today(),
          prefectureId: undefined,
        }),
      };

      mock.module("../../utils/dateUtils", () => ({
        validateDateRange: mockValidateDateRange,
      }));
      mock.module("../../utils/prefectureUtils", () => ({
        findNearestPrefecture: mockFindNearestPrefecture,
        calculateDistance: mock().mockReturnValue(5.2),
      }));
      mock.module("../../dao/touringIndexSchemas", () => ({
        getTouringIndexHistorySchema: mockGetTouringIndexHistorySchema,
      }));

      // Measure API response time
      const result = await PerformanceTester.measureAsync(async () => {
        await getTouringIndexHistory(context);
        return context._testResponse;
      });

      // Verify performance
      expect(result.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.NORMAL);

      // Verify response structure
      ResponseAssertions.assertSuccess(context);
      ResponseAssertions.assertHasFields(context, ["location", "prefecture_id", "data"]);
      expect(result.result.data.data).toHaveLength(historyDates.length);
    });

    test("should handle API errors gracefully under load", async () => {
      // Setup error scenario
      MockScenarioFactory.databaseError(touringIndexRepo);

      const context = ContextMockFactory.withQuery({
        lat: "35.6762",
        lon: "139.6503",
      });

      // Run multiple requests to test error handling consistency
      const loadResult = await LoadTester.loadTest(
        async () => {
          try {
            await getTouringIndexHistory(context);
            return context._testResponse;
          } catch (error) {
            // API should handle errors gracefully, not throw
            throw new Error("API handler threw unexpected error");
          }
        },
        2, // concurrency
        8  // total requests
      );

      // Verify all requests completed (even if with errors)
      expect(loadResult.successRate).toBe(1.0);
      expect(loadResult.errors.length).toBe(0);
    });
  });

  describe("Memory Usage Integration", () => {
    test("should not leak memory during batch operations", async () => {
      const weatherRepo = RepositoryMockFactory.weather();
      const touringIndexRepo = RepositoryMockFactory.touringIndex();
      const batchUsecase = new BatchCalculateTouringIndexUsecase(weatherRepo, touringIndexRepo);

      MockScenarioFactory.successfulBatchProcessing(weatherRepo, touringIndexRepo);

      // Test memory usage during repeated operations
      const memoryResult = await MemoryTester.measureMemory(async () => {
        const promises = Array(5).fill(null).map(() => 
          batchUsecase.execute([DateFixture.today()], 1)
        );
        return Promise.all(promises);
      });

      // Verify memory usage is reasonable (if memory monitoring is available)
      if (memoryResult.memoryDelta) {
        const heapUsedMB = memoryResult.memoryDelta.heapUsed / (1024 * 1024);
        expect(heapUsedMB).toBeLessThan(50); // Should not use more than 50MB
      }
    });

    test("should handle large dataset processing efficiently", async () => {
      // Test with larger dataset
      const largePrefectureList = Array(20).fill(null).map((_, index) => 
        PrefectureFixture.create({ id: index + 1, name_en: `Prefecture${index + 1}` })
      );
      
      const largeDateRange = Array(10).fill(null).map((_, index) => 
        DateFixture.daysFromToday(index)
      );

      const weatherRepo = RepositoryMockFactory.weather();
      const touringIndexRepo = RepositoryMockFactory.touringIndex();
      const batchUsecase = new BatchCalculateTouringIndexUsecase(weatherRepo, touringIndexRepo);

      MockScenarioFactory.successfulBatchProcessing(
        weatherRepo, 
        touringIndexRepo, 
        largePrefectureList
      );

      // Measure performance with large dataset
      const result = await PerformanceTester.measureAsync(async () => {
        return batchUsecase.execute(largeDateRange, 1);
      });

      // Should still complete in reasonable time even with large dataset
      expect(result.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.VERY_SLOW);
      expect(result.result.total_processed).toBe(largePrefectureList.length * largeDateRange.length);
    });
  });

  describe("Data Consistency Integration", () => {
    test("should maintain data consistency across operations", async () => {
      // Test that the same input always produces the same output
      const weather = WeatherFixture.create({
        temperature: 20.5,
        windSpeed: 3.2,
        humidity: 65,
      });

      const results = await Promise.all(
        Array(10).fill(null).map(() => calculateTouringIndex(weather))
      );

      // All results should be identical
      const firstResult = results[0];
      results.forEach(result => {
        expect(result.score).toBe(firstResult.score);
        expect(result.breakdown).toEqual(firstResult.breakdown);
      });
    });

    test("should produce deterministic batch results", async () => {
      const weatherRepo = RepositoryMockFactory.weather();
      const touringIndexRepo = RepositoryMockFactory.touringIndex();
      const batchUsecase = new BatchCalculateTouringIndexUsecase(weatherRepo, touringIndexRepo);

      const prefectures = PrefectureFixture.list();
      const targetDates = [DateFixture.today()];

      // Setup deterministic mock responses
      const fixedWeatherData = [WeatherFixture.perfect()];
      weatherRepo.getWeatherBatch.mockResolvedValue(fixedWeatherData);
      touringIndexRepo.getAllPrefectures.mockResolvedValue(prefectures);
      touringIndexRepo.upsertTouringIndex.mockResolvedValue();

      // Run batch processing multiple times
      const results = await Promise.all(
        Array(3).fill(null).map(() => batchUsecase.execute(targetDates, 1))
      );

      // All batch results should be identical
      const firstResult = results[0];
      results.forEach(result => {
        expect(result.total_processed).toBe(firstResult.total_processed);
        expect(result.successful_inserts).toBe(firstResult.successful_inserts);
        expect(result.failed_inserts).toBe(firstResult.failed_inserts);
      });
    });
  });
});