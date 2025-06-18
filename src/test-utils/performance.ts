// src/test-utils/performance.ts

import { expect } from "bun:test";

/**
 * Performance benchmark thresholds in milliseconds
 */
export const PERFORMANCE_THRESHOLDS = {
  VERY_FAST: 10,
  FAST: 50,
  NORMAL: 200,
  SLOW: 1000,
  VERY_SLOW: 5000,
} as const;

/**
 * Performance testing utilities
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Test utilities pattern
export class PerformanceTester {
  /**
   * Measure execution time of a synchronous function
   */
  static measure<T>(fn: () => T): { result: T; duration: number } {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    return { result, duration };
  }

  /**
   * Measure execution time of an asynchronous function
   */
  static async measureAsync<T>(
    fn: () => Promise<T>,
  ): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    return { result, duration };
  }

  /**
   * Run a function multiple times and get statistics
   */
  static async benchmark<T>(
    fn: () => Promise<T>,
    iterations = 10,
  ): Promise<{
    results: T[];
    durations: number[];
    average: number;
    min: number;
    max: number;
    median: number;
  }> {
    const results: T[] = [];
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const { result, duration } = await PerformanceTester.measureAsync(fn);
      results.push(result);
      durations.push(duration);
    }

    const sortedDurations = [...durations].sort((a, b) => a - b);
    const average = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);
    const median = sortedDurations[Math.floor(sortedDurations.length / 2)];

    return {
      results,
      durations,
      average,
      min,
      max,
      median,
    };
  }

  /**
   * Assert that a function executes within a time threshold
   */
  static async assertPerformance<T>(
    fn: () => Promise<T>,
    threshold: number,
    description?: string,
  ): Promise<T> {
    const { result, duration } = await PerformanceTester.measureAsync(fn);

    const _message = description
      ? `${description} should complete within ${threshold}ms (took ${duration.toFixed(2)}ms)`
      : `Operation should complete within ${threshold}ms (took ${duration.toFixed(2)}ms)`;

    expect(duration).toBeLessThan(threshold);

    return result;
  }

  /**
   * Assert that a function is "fast" (< 50ms)
   */
  static async assertFast<T>(
    fn: () => Promise<T>,
    description?: string,
  ): Promise<T> {
    return PerformanceTester.assertPerformance(
      fn,
      PERFORMANCE_THRESHOLDS.FAST,
      description,
    );
  }

  /**
   * Assert that a function completes in "normal" time (< 200ms)
   */
  static async assertNormal<T>(
    fn: () => Promise<T>,
    description?: string,
  ): Promise<T> {
    return PerformanceTester.assertPerformance(
      fn,
      PERFORMANCE_THRESHOLDS.NORMAL,
      description,
    );
  }

  /**
   * Assert that a function doesn't take too long (< 1000ms)
   */
  static async assertNotSlow<T>(
    fn: () => Promise<T>,
    description?: string,
  ): Promise<T> {
    return PerformanceTester.assertPerformance(
      fn,
      PERFORMANCE_THRESHOLDS.SLOW,
      description,
    );
  }

  /**
   * Profile a function and return detailed timing information
   */
  static async profile<T>(
    fn: () => Promise<T>,
    iterations = 10,
  ): Promise<{
    result: T;
    stats: {
      total: number;
      average: number;
      min: number;
      max: number;
      median: number;
      p95: number;
      p99: number;
    };
    classification: "very_fast" | "fast" | "normal" | "slow" | "very_slow";
  }> {
    const benchmark = await PerformanceTester.benchmark(fn, iterations);
    const sortedDurations = [...benchmark.durations].sort((a, b) => a - b);

    const p95Index = Math.floor(sortedDurations.length * 0.95);
    const p99Index = Math.floor(sortedDurations.length * 0.99);

    const stats = {
      total: benchmark.durations.reduce((sum, d) => sum + d, 0),
      average: benchmark.average,
      min: benchmark.min,
      max: benchmark.max,
      median: benchmark.median,
      p95: sortedDurations[p95Index],
      p99: sortedDurations[p99Index],
    };

    // Classify performance based on average
    let classification: "very_fast" | "fast" | "normal" | "slow" | "very_slow";
    if (stats.average < PERFORMANCE_THRESHOLDS.VERY_FAST) {
      classification = "very_fast";
    } else if (stats.average < PERFORMANCE_THRESHOLDS.FAST) {
      classification = "fast";
    } else if (stats.average < PERFORMANCE_THRESHOLDS.NORMAL) {
      classification = "normal";
    } else if (stats.average < PERFORMANCE_THRESHOLDS.SLOW) {
      classification = "slow";
    } else {
      classification = "very_slow";
    }

    return {
      result: benchmark.results[0], // Return the first result
      stats,
      classification,
    };
  }
}

/**
 * Memory usage testing utilities
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Test utilities pattern
export class MemoryTester {
  /**
   * Get current memory usage (if available in the environment)
   */
  static getMemoryUsage(): {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  } | null {
    if (typeof process !== "undefined" && process.memoryUsage) {
      return process.memoryUsage();
    }
    return null;
  }

  /**
   * Measure memory usage before and after a function execution
   */
  static async measureMemory<T>(fn: () => Promise<T>): Promise<{
    result: T;
    memoryDelta: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    } | null;
  }> {
    const beforeMemory = MemoryTester.getMemoryUsage();
    const result = await fn();
    const afterMemory = MemoryTester.getMemoryUsage();

    let memoryDelta = null;
    if (beforeMemory && afterMemory) {
      memoryDelta = {
        rss: afterMemory.rss - beforeMemory.rss,
        heapTotal: afterMemory.heapTotal - beforeMemory.heapTotal,
        heapUsed: afterMemory.heapUsed - beforeMemory.heapUsed,
        external: afterMemory.external - beforeMemory.external,
      };
    }

    return { result, memoryDelta };
  }

  /**
   * Assert that memory usage doesn't exceed a threshold
   */
  static async assertMemoryUsage<T>(
    fn: () => Promise<T>,
    maxHeapUsedMB: number,
  ): Promise<T> {
    const { result, memoryDelta } = await MemoryTester.measureMemory(fn);

    if (memoryDelta) {
      const heapUsedMB = memoryDelta.heapUsed / (1024 * 1024);
      expect(heapUsedMB).toBeLessThan(maxHeapUsedMB);
    }

    return result;
  }
}

/**
 * Load testing utilities for stress testing
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Test utilities pattern
export class LoadTester {
  /**
   * Run concurrent executions of a function
   */
  static async loadTest<T>(
    fn: () => Promise<T>,
    concurrency: number,
    totalRequests: number,
  ): Promise<{
    results: T[];
    durations: number[];
    errors: Error[];
    successRate: number;
    averageDuration: number;
    requestsPerSecond: number;
  }> {
    const results: T[] = [];
    const durations: number[] = [];
    const errors: Error[] = [];

    const startTime = Date.now();
    const batches = Math.ceil(totalRequests / concurrency);

    for (let batch = 0; batch < batches; batch++) {
      const batchSize = Math.min(
        concurrency,
        totalRequests - batch * concurrency,
      );
      const promises = Array(batchSize)
        .fill(null)
        .map(async () => {
          try {
            const { result, duration } =
              await PerformanceTester.measureAsync(fn);
            results.push(result);
            durations.push(duration);
          } catch (error) {
            errors.push(error as Error);
          }
        });

      await Promise.all(promises);
    }

    const totalTime = Date.now() - startTime;
    const successRate = results.length / totalRequests;
    const averageDuration =
      durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const requestsPerSecond = totalRequests / (totalTime / 1000);

    return {
      results,
      durations,
      errors,
      successRate,
      averageDuration,
      requestsPerSecond,
    };
  }

  /**
   * Test function under increasing load
   */
  static async stressTest<T>(
    fn: () => Promise<T>,
    startConcurrency = 1,
    maxConcurrency = 10,
    requestsPerLevel = 10,
  ): Promise<
    Array<{
      concurrency: number;
      successRate: number;
      averageDuration: number;
      requestsPerSecond: number;
      errors: number;
    }>
  > {
    const results = [];

    for (
      let concurrency = startConcurrency;
      concurrency <= maxConcurrency;
      concurrency++
    ) {
      const loadTestResult = await LoadTester.loadTest(
        fn,
        concurrency,
        requestsPerLevel,
      );

      results.push({
        concurrency,
        successRate: loadTestResult.successRate,
        averageDuration: loadTestResult.averageDuration,
        requestsPerSecond: loadTestResult.requestsPerSecond,
        errors: loadTestResult.errors.length,
      });
    }

    return results;
  }
}

/**
 * Test utilities for creating performance test suites
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Test utilities pattern
export class PerformanceTestSuite {
  /**
   * Create a standard performance test for a function
   */
  static createTest<T>(
    name: string,
    fn: () => Promise<T>,
    options: {
      maxDuration?: number;
      iterations?: number;
      maxMemoryMB?: number;
    } = {},
  ) {
    const {
      maxDuration = PERFORMANCE_THRESHOLDS.NORMAL,
      iterations = 5,
      maxMemoryMB = 50,
    } = options;

    return {
      name: `Performance: ${name}`,
      test: async () => {
        // Performance test
        const performanceResult = await PerformanceTester.profile(
          fn,
          iterations,
        );

        expect(performanceResult.stats.average).toBeLessThan(maxDuration);
        expect(performanceResult.classification).not.toBe("very_slow");

        // Memory test (if available)
        if (MemoryTester.getMemoryUsage()) {
          await MemoryTester.assertMemoryUsage(fn, maxMemoryMB);
        }

        // Log performance info for debugging
        console.log(`Performance stats for ${name}:`, {
          average: `${performanceResult.stats.average.toFixed(2)}ms`,
          classification: performanceResult.classification,
          p95: `${performanceResult.stats.p95.toFixed(2)}ms`,
        });
      },
    };
  }

  /**
   * Create a load test for a function
   */
  static createLoadTest<T>(
    name: string,
    fn: () => Promise<T>,
    options: {
      concurrency?: number;
      totalRequests?: number;
      minSuccessRate?: number;
    } = {},
  ) {
    const {
      concurrency = 5,
      totalRequests = 20,
      minSuccessRate = 0.95,
    } = options;

    return {
      name: `Load Test: ${name}`,
      test: async () => {
        const loadResult = await LoadTester.loadTest(
          fn,
          concurrency,
          totalRequests,
        );

        expect(loadResult.successRate).toBeGreaterThanOrEqual(minSuccessRate);
        expect(loadResult.errors.length).toBeLessThan(totalRequests * 0.1); // Max 10% errors

        // Log load test results
        console.log(`Load test results for ${name}:`, {
          successRate: `${(loadResult.successRate * 100).toFixed(1)}%`,
          averageDuration: `${loadResult.averageDuration.toFixed(2)}ms`,
          requestsPerSecond: loadResult.requestsPerSecond.toFixed(1),
          errors: loadResult.errors.length,
        });
      },
    };
  }
}
