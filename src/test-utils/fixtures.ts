// src/test-utils/fixtures.ts

import type { Weather, WeatherCondition, AirQualityLevel } from "../domain/Weather";
import type { Prefecture } from "../types/prefecture";
import type { TouringIndexBatchItem } from "../usecase/BatchCalculateTouringIndex";

/**
 * Test fixture factory for Weather objects
 */
export class WeatherFixture {
  /**
   * Create a perfect touring weather scenario
   */
  static perfect(): Weather {
    return {
      datetime: "2025-06-01T12:00:00Z",
      condition: "clear" as WeatherCondition,
      temperature: 21.5, // Ideal temperature
      windSpeed: 2.5, // Ideal wind
      humidity: 50, // Ideal humidity
      visibility: 20, // Excellent visibility
      precipitationProbability: 0, // No rain
      uvIndex: 3, // Safe UV
      airQuality: "low" as AirQualityLevel,
    };
  }

  /**
   * Create a worst-case touring weather scenario
   */
  static worst(): Weather {
    return {
      datetime: "2025-06-01T12:00:00Z",
      condition: "snow" as WeatherCondition,
      temperature: -50, // Extremely cold
      windSpeed: 50, // Maximum wind
      humidity: 100, // Maximum humidity
      visibility: 0, // No visibility
      precipitationProbability: 100, // Certain precipitation
      uvIndex: 20, // Maximum UV
      airQuality: "high" as AirQualityLevel,
    };
  }

  /**
   * Create weather with specified overrides
   */
  static create(overrides: Partial<Weather> = {}): Weather {
    return {
      ...WeatherFixture.perfect(),
      ...overrides,
    };
  }

  /**
   * Create weather for temperature boundary testing
   */
  static withTemperature(temperature: number): Weather {
    return WeatherFixture.create({ temperature });
  }

  /**
   * Create weather for wind speed boundary testing
   */
  static withWindSpeed(windSpeed: number): Weather {
    return WeatherFixture.create({ windSpeed });
  }

  /**
   * Create weather for humidity boundary testing
   */
  static withHumidity(humidity: number): Weather {
    return WeatherFixture.create({ humidity });
  }

  /**
   * Create weather for visibility boundary testing
   */
  static withVisibility(visibility: number): Weather {
    return WeatherFixture.create({ visibility });
  }

  /**
   * Create weather for precipitation probability testing
   */
  static withPrecipitationProbability(precipitationProbability: number): Weather {
    return WeatherFixture.create({ precipitationProbability });
  }

  /**
   * Create weather for UV index testing
   */
  static withUvIndex(uvIndex: number): Weather {
    return WeatherFixture.create({ uvIndex });
  }

  /**
   * Create weather for air quality testing
   */
  static withAirQuality(airQuality: AirQualityLevel): Weather {
    return WeatherFixture.create({ airQuality });
  }

  /**
   * Create weather for condition testing
   */
  static withCondition(condition: WeatherCondition): Weather {
    return WeatherFixture.create({ condition });
  }
}

/**
 * Test fixture factory for Prefecture objects
 */
export class PrefectureFixture {
  /**
   * Create Tokyo prefecture data
   */
  static tokyo(): Prefecture {
    return {
      id: 13,
      name_ja: "東京都",
      name_en: "Tokyo",
      latitude: 35.6762,
      longitude: 139.6503,
    };
  }

  /**
   * Create Osaka prefecture data
   */
  static osaka(): Prefecture {
    return {
      id: 27,
      name_ja: "大阪府",
      name_en: "Osaka",
      latitude: 34.6937,
      longitude: 135.5023,
    };
  }

  /**
   * Create Kanagawa prefecture data
   */
  static kanagawa(): Prefecture {
    return {
      id: 14,
      name_ja: "神奈川県",
      name_en: "Kanagawa",
      latitude: 35.4437,
      longitude: 139.6380,
    };
  }

  /**
   * Create a list of test prefectures
   */
  static list(): Prefecture[] {
    return [
      PrefectureFixture.tokyo(),
      PrefectureFixture.kanagawa(),
      PrefectureFixture.osaka(),
    ];
  }

  /**
   * Create prefecture with specified overrides
   */
  static create(overrides: Partial<Prefecture>): Prefecture {
    return {
      ...PrefectureFixture.tokyo(),
      ...overrides,
    };
  }
}

/**
 * Test fixture factory for TouringIndexBatchItem objects
 */
export class TouringIndexBatchItemFixture {
  /**
   * Create a standard batch item
   */
  static create(overrides: Partial<TouringIndexBatchItem> = {}): TouringIndexBatchItem {
    const weather = WeatherFixture.perfect();
    const factors = {
      weather: 30,
      temperature: 20,
      wind: 15,
      humidity: 10,
      visibility: 5,
      precipitationProbability: 10,
      uvIndex: 5,
      airQuality: 5,
    };

    return {
      prefecture_id: 13,
      date: "2025-06-01",
      score: 100,
      weather_factors_json: JSON.stringify(factors),
      weather_raw_json: JSON.stringify(weather),
      calculated_at: "2025-06-01T12:00:00Z",
      ...overrides,
    };
  }

  /**
   * Create multiple batch items for different dates
   */
  static createMultiple(
    prefectureId: number,
    startDate: string,
    days: number
  ): TouringIndexBatchItem[] {
    const items: TouringIndexBatchItem[] = [];
    const start = new Date(startDate);

    for (let i = 0; i < days; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const dateString = date.toISOString().split("T")[0];

      items.push(
        TouringIndexBatchItemFixture.create({
          prefecture_id: prefectureId,
          date: dateString,
          score: Math.floor(Math.random() * 100), // Random score for variety
        })
      );
    }

    return items;
  }
}

/**
 * Date utility fixtures for testing
 */
export class DateFixture {
  /**
   * Get today's date string in YYYY-MM-DD format
   */
  static today(): string {
    return new Date().toISOString().split("T")[0];
  }

  /**
   * Get date string N days from today
   */
  static daysFromToday(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
  }

  /**
   * Get yesterday's date string
   */
  static yesterday(): string {
    return DateFixture.daysFromToday(-1);
  }

  /**
   * Get tomorrow's date string
   */
  static tomorrow(): string {
    return DateFixture.daysFromToday(1);
  }

  /**
   * Get date range for testing
   */
  static range(startDaysFromToday: number, endDaysFromToday: number): {
    startDate: string;
    endDate: string;
  } {
    return {
      startDate: DateFixture.daysFromToday(startDaysFromToday),
      endDate: DateFixture.daysFromToday(endDaysFromToday),
    };
  }

  /**
   * Get ISO datetime string for testing
   */
  static isoDateTime(dateString?: string): string {
    if (dateString) {
      return `${dateString}T12:00:00Z`;
    }
    return new Date().toISOString();
  }
}

/**
 * API response fixtures for testing
 */
export class ApiResponseFixture {
  /**
   * Create mock touring index history data
   */
  static touringIndexHistory(prefectureId: number, dates: string[]) {
    return dates.map((date, index) => ({
      id: index + 1,
      prefecture_id: prefectureId,
      date,
      score: 80 + Math.floor(Math.random() * 20), // Random score 80-100
      weather_factors_json: JSON.stringify({
        weather: 25,
        temperature: 18,
        wind: 12,
        humidity: 8,
        visibility: 5,
        precipitationProbability: 8,
        uvIndex: 4,
        airQuality: 5,
      }),
      weather_raw_json: JSON.stringify(
        WeatherFixture.create({
          datetime: DateFixture.isoDateTime(date),
          temperature: 20 + Math.random() * 5, // Random temp 20-25
        })
      ),
      calculated_at: DateFixture.isoDateTime(date),
    }));
  }

  /**
   * Create mock error response
   */
  static error(message: string, statusCode: number = 400) {
    return {
      error: message,
      requestId: "test-request-id",
    };
  }

  /**
   * Create mock validation error response
   */
  static validationError(field: string, message: string) {
    return {
      error: "Invalid parameters",
      details: [`${field}: ${message}`],
      requestId: "test-request-id",
    };
  }
}

/**
 * Performance testing utilities
 */
export class PerformanceFixture {
  /**
   * Measure execution time of a function
   */
  static async measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    return { result, duration };
  }

  /**
   * Run function multiple times and get average execution time
   */
  static async measureAverageTime<T>(
    fn: () => Promise<T>,
    iterations: number = 10
  ): Promise<{ averageDuration: number; results: T[] }> {
    const results: T[] = [];
    let totalDuration = 0;

    for (let i = 0; i < iterations; i++) {
      const { result, duration } = await PerformanceFixture.measureTime(fn);
      results.push(result);
      totalDuration += duration;
    }

    return {
      averageDuration: totalDuration / iterations,
      results,
    };
  }

  /**
   * Create performance benchmark thresholds
   */
  static benchmarks() {
    return {
      FAST: 100, // ms
      NORMAL: 500, // ms
      SLOW: 2000, // ms
    };
  }
}