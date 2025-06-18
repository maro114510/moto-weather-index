// src/usecase/CalculateTouringIndex.performance.test.ts

import { describe, expect, test } from "bun:test";
import { WeatherFixture } from "../test-utils/fixtures";
import {
  LoadTester,
  MemoryTester,
  PERFORMANCE_THRESHOLDS,
  PerformanceTestSuite,
  PerformanceTester,
} from "../test-utils/performance";
import { calculateTouringIndex } from "./CalculateTouringIndex";

describe("CalculateTouringIndex Performance Tests", () => {
  describe("Single Calculation Performance", () => {
    test("should calculate touring index very quickly", async () => {
      const weather = WeatherFixture.perfect();

      await PerformanceTester.assertFast(
        async () => calculateTouringIndex(weather),
        "Perfect weather calculation",
      );
    });

    test("should handle worst case scenario efficiently", async () => {
      const weather = WeatherFixture.worst();

      await PerformanceTester.assertFast(
        async () => calculateTouringIndex(weather),
        "Worst weather calculation",
      );
    });

    test("should provide consistent performance across weather conditions", async () => {
      const weatherConditions = [
        WeatherFixture.perfect(),
        WeatherFixture.worst(),
        WeatherFixture.withTemperature(0),
        WeatherFixture.withWindSpeed(10),
        WeatherFixture.withHumidity(100),
        WeatherFixture.withVisibility(0),
        WeatherFixture.withPrecipitationProbability(100),
        WeatherFixture.withUvIndex(20),
        WeatherFixture.withCondition("snow"),
      ];

      const durations: number[] = [];

      for (const weather of weatherConditions) {
        const { duration } = await PerformanceTester.measureAsync(async () =>
          calculateTouringIndex(weather),
        );
        durations.push(duration);
      }

      // All calculations should be very fast
      durations.forEach((duration) => {
        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.VERY_FAST);
      });

      // Performance should be consistent (low variance)
      const average =
        durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const variance =
        durations.reduce((sum, d) => sum + (d - average) ** 2, 0) /
        durations.length;
      const standardDeviation = Math.sqrt(variance);

      // Standard deviation should be reasonable relative to average
      // For very fast operations, we allow higher relative variance due to measurement precision
      expect(standardDeviation / average).toBeLessThan(2.0); // Less than 200% coefficient of variation
    });
  });

  describe("Bulk Processing Performance", () => {
    test("should handle bulk calculations efficiently", async () => {
      const weatherList = Array(100)
        .fill(null)
        .map((_, index) =>
          WeatherFixture.create({
            temperature: 15 + (index % 20), // Vary temperature 15-35
            windSpeed: index % 10, // Vary wind speed 0-9
            humidity: 40 + (index % 40), // Vary humidity 40-80
          }),
        );

      const result = await PerformanceTester.measureAsync(async () => {
        return weatherList.map((weather) => calculateTouringIndex(weather));
      });

      // 100 calculations should complete quickly
      expect(result.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST);
      expect(result.result).toHaveLength(100);

      // All results should be valid
      result.result.forEach((touringIndex) => {
        expect(touringIndex.score).toBeGreaterThanOrEqual(0);
        expect(touringIndex.score).toBeLessThanOrEqual(100);
        expect(Number.isInteger(touringIndex.score)).toBe(true);
      });
    });

    test("should scale linearly with input size", async () => {
      const sizes = [10, 50, 100, 500];
      const results: Array<{
        size: number;
        duration: number;
        throughput: number;
      }> = [];

      for (const size of sizes) {
        const weatherList = Array(size)
          .fill(null)
          .map(() => WeatherFixture.perfect());

        const { duration } = await PerformanceTester.measureAsync(async () => {
          return weatherList.map((weather) => calculateTouringIndex(weather));
        });

        results.push({
          size,
          duration,
          throughput: size / duration, // calculations per ms
        });
      }

      // Performance should scale roughly linearly
      // (throughput should remain relatively constant)
      const throughputs = results.map((r) => r.throughput);
      const minThroughput = Math.min(...throughputs);
      const maxThroughput = Math.max(...throughputs);

      // Throughput variance should be reasonable for very fast operations
      // Allow higher variance due to measurement precision at microsecond level
      expect(maxThroughput / minThroughput).toBeLessThan(10.0);

      // Log performance scaling for analysis
      console.table(results);
    });
  });

  describe("Memory Usage", () => {
    test("should not consume excessive memory", async () => {
      await MemoryTester.assertMemoryUsage(
        async () => {
          // Process a large batch to test memory usage
          const weatherList = Array(1000)
            .fill(null)
            .map(() => WeatherFixture.perfect());
          return weatherList.map((weather) => calculateTouringIndex(weather));
        },
        10, // Max 10MB heap usage increase
      );
    });

    test("should not leak memory with repeated calculations", async () => {
      const weather = WeatherFixture.perfect();

      const memoryResult = await MemoryTester.measureMemory(async () => {
        // Perform many calculations to test for memory leaks
        for (let i = 0; i < 1000; i++) {
          calculateTouringIndex(weather);
        }
      });

      // Memory delta should be minimal (if memory monitoring is available)
      if (memoryResult.memoryDelta) {
        const heapUsedMB = memoryResult.memoryDelta.heapUsed / (1024 * 1024);
        expect(heapUsedMB).toBeLessThan(5); // Should not use more than 5MB
      }
    });
  });

  describe("Load Testing", () => {
    test("should handle concurrent calculations", async () => {
      const weather = WeatherFixture.perfect();

      const loadResult = await LoadTester.loadTest(
        async () => calculateTouringIndex(weather),
        10, // 10 concurrent executions
        100, // 100 total requests
      );

      // Should have high success rate
      expect(loadResult.successRate).toBeGreaterThanOrEqual(0.99);
      expect(loadResult.errors.length).toBeLessThan(2);

      // Should maintain good performance under load
      expect(loadResult.averageDuration).toBeLessThan(
        PERFORMANCE_THRESHOLDS.FAST,
      );

      // Should process requests quickly
      expect(loadResult.requestsPerSecond).toBeGreaterThan(100);
    });

    test("should maintain performance under stress", async () => {
      const weather = WeatherFixture.perfect();

      const stressResults = await LoadTester.stressTest(
        async () => calculateTouringIndex(weather),
        1, // start with 1 concurrent
        20, // up to 20 concurrent
        10, // 10 requests per level
      );

      // Performance should degrade gracefully
      let previousRequestsPerSecond = Number.POSITIVE_INFINITY;
      stressResults.forEach((result) => {
        expect(result.successRate).toBeGreaterThanOrEqual(0.95);
        expect(result.averageDuration).toBeLessThan(
          PERFORMANCE_THRESHOLDS.NORMAL,
        );

        // Requests per second should not drop dramatically
        if (previousRequestsPerSecond !== Number.POSITIVE_INFINITY) {
          expect(result.requestsPerSecond).toBeGreaterThan(
            previousRequestsPerSecond * 0.5,
          );
        }
        previousRequestsPerSecond = result.requestsPerSecond;
      });

      // Log stress test results for analysis
      console.table(stressResults);
    });
  });

  describe("Performance Profiling", () => {
    test("should profile different weather scenarios", async () => {
      const scenarios = [
        { name: "perfect", weather: WeatherFixture.perfect() },
        { name: "worst", weather: WeatherFixture.worst() },
        { name: "cold", weather: WeatherFixture.withTemperature(-20) },
        { name: "hot", weather: WeatherFixture.withTemperature(45) },
        { name: "windy", weather: WeatherFixture.withWindSpeed(15) },
        { name: "humid", weather: WeatherFixture.withHumidity(95) },
        { name: "low_visibility", weather: WeatherFixture.withVisibility(1) },
        { name: "high_uv", weather: WeatherFixture.withUvIndex(15) },
      ];

      const profiles = [];

      for (const scenario of scenarios) {
        const profile = await PerformanceTester.profile(
          async () => calculateTouringIndex(scenario.weather),
          20, // 20 iterations for good statistics
        );

        profiles.push({
          scenario: scenario.name,
          average: profile.stats.average.toFixed(2),
          p95: profile.stats.p95.toFixed(2),
          classification: profile.classification,
        });

        // All scenarios should be classified as fast or very fast
        expect(["very_fast", "fast"]).toContain(profile.classification);
      }

      // Log performance profiles for analysis
      console.table(profiles);
    });
  });

  describe("Performance Test Suite", () => {
    const performanceTests = [
      PerformanceTestSuite.createTest(
        "perfect weather calculation",
        async () => calculateTouringIndex(WeatherFixture.perfect()),
        { maxDuration: PERFORMANCE_THRESHOLDS.VERY_FAST },
      ),
      PerformanceTestSuite.createTest(
        "worst weather calculation",
        async () => calculateTouringIndex(WeatherFixture.worst()),
        { maxDuration: PERFORMANCE_THRESHOLDS.VERY_FAST },
      ),
      PerformanceTestSuite.createTest(
        "bulk calculation (100 items)",
        async () => {
          const weatherList = Array(100)
            .fill(null)
            .map(() => WeatherFixture.perfect());
          return weatherList.map((weather) => calculateTouringIndex(weather));
        },
        { maxDuration: PERFORMANCE_THRESHOLDS.FAST, maxMemoryMB: 10 },
      ),
      PerformanceTestSuite.createLoadTest(
        "concurrent calculations",
        async () => calculateTouringIndex(WeatherFixture.perfect()),
        { concurrency: 5, totalRequests: 25, minSuccessRate: 0.99 },
      ),
    ];

    // Run all performance tests
    performanceTests.forEach((perfTest) => {
      test(perfTest.name, perfTest.test);
    });
  });
});
