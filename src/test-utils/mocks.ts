// src/test-utils/mocks.ts

import { mock } from "bun:test";
import type { Context } from "hono";
import { ZodError } from "zod";
import { HTTP_STATUS } from "../constants/httpStatus";
import type { Prefecture } from "../types/prefecture";
import type { TouringIndexBatchItem } from "../usecase/BatchCalculateTouringIndex";
import { ApiResponseFixture, PrefectureFixture } from "./fixtures";

/**
 * Mock factory for Hono Context objects
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Test utilities pattern
export class ContextMockFactory {
  /**
   * Create a basic mock context with common properties
   */
  static create(overrides: Partial<Context> = {}): Context {
    const capturedResponse = { data: {}, status: 200 };

    const baseContext = {
      get: mock(() => ({})),
      req: {
        query: mock((key?: string) => {
          if (key === undefined) return {};
          return "";
        }),
        method: "GET",
        path: "/test",
      } as any,
      json: mock((data: any, status?: any) => {
        capturedResponse.data = data;
        capturedResponse.status = status || 200;
        return {} as any;
      }) as any,
      env: {
        DB: {
          /* mock D1 database */
        },
        OPEN_METEO_CACHE: {
          /* mock KV store */
        },
      } as any,
      // Add captured response for test verification
      _testResponse: capturedResponse,
    };

    return { ...baseContext, ...overrides } as any;
  }

  /**
   * Create context with specific query parameters
   */
  static withQuery(params: Record<string, string>): Context {
    const queryMock = mock((key?: string) => {
      if (key === undefined) return params;
      return params[key];
    });

    return ContextMockFactory.create({
      req: {
        query: queryMock,
        method: "GET",
        path: "/test",
      } as any,
    });
  }

  /**
   * Create context without database (for testing database unavailable scenarios)
   */
  static withoutDatabase(): Context {
    return ContextMockFactory.create({
      env: {} as any,
    });
  }

  /**
   * Create context with request context data
   */
  static withRequestContext(requestId = "test-request-id"): Context {
    return ContextMockFactory.create({
      get: mock((key: string) => {
        if (key === "requestContext") {
          return {
            requestId,
            method: "GET",
            path: "/test",
            operation: "test_operation",
          };
        }
        return {};
      }),
    });
  }
}

/**
 * Mock factory for repository objects
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Test utilities pattern
export class RepositoryMockFactory {
  /**
   * Create a mock touring index repository
   */
  static touringIndex() {
    return {
      upsertTouringIndex: mock(),
      getAllPrefectures: mock(),
      getTouringIndexByPrefectureAndDateRange: mock(),
      getTouringIndexCount: mock(),
      deleteTouringIndexByDateRange: mock(),
    };
  }

  /**
   * Create a mock weather repository
   */
  static weather() {
    return {
      getWeather: mock(),
      getWeatherBatch: mock(),
    };
  }

  /**
   * Create a mock D1 database
   */
  static database() {
    const mockResult = {
      results: [],
      success: true,
      meta: {},
    };

    const mockStatement = {
      bind: mock().mockReturnThis(),
      all: mock().mockResolvedValue(mockResult),
      first: mock().mockResolvedValue({}),
      run: mock().mockResolvedValue({ changes: 1, success: true }),
    };

    return {
      prepare: mock().mockReturnValue(mockStatement),
      exec: mock().mockResolvedValue(mockResult),
      _mockStatement: mockStatement,
      _mockResult: mockResult,
    };
  }
}

/**
 * Mock factory for external API responses
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Test utilities pattern
export class ExternalApiMockFactory {
  /**
   * Create mock Open-Meteo API response
   */
  static openMeteoResponse(dates: string[] = ["2025-06-01"]) {
    return {
      data: {
        daily: {
          time: dates,
          weathercode: dates.map(() => 0), // Clear weather
          temperature_2m_max: dates.map(() => 25),
          temperature_2m_min: dates.map(() => 15),
          windspeed_10m_max: dates.map(() => 5),
          relative_humidity_2m_max: dates.map(() => 60),
          precipitation_probability_max: dates.map(() => 10),
          uv_index_max: dates.map(() => 4),
        },
      },
      status: 200,
    };
  }

  /**
   * Create mock axios error
   */
  static axiosError(statusCode = 500, message = "API Error") {
    const error = new Error(message);
    (error as any).response = {
      status: statusCode,
      statusText: statusCode === 500 ? "Internal Server Error" : "Bad Request",
    };
    (error as any).isAxiosError = true;
    return error;
  }
}

/**
 * Mock factory for validation errors
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Test utilities pattern
export class ValidationMockFactory {
  /**
   * Create a Zod validation error
   */
  static zodError(field: string, message: string): ZodError {
    return new ZodError([
      {
        code: "custom",
        path: [field],
        message,
      },
    ]);
  }

  /**
   * Create multiple field validation errors
   */
  static multipleFieldErrors(
    errors: Array<{ field: string; message: string }>,
  ): ZodError {
    return new ZodError(
      errors.map(({ field, message }) => ({
        code: "custom" as const,
        path: [field],
        message,
      })),
    );
  }

  /**
   * Create coordinate validation error
   */
  static coordinateError(lat?: string, lon?: string): ZodError {
    const errors = [];
    if (lat) {
      errors.push({ field: "lat", message: lat });
    }
    if (lon) {
      errors.push({ field: "lon", message: lon });
    }
    return ValidationMockFactory.multipleFieldErrors(errors);
  }

  /**
   * Create date validation error
   */
  static dateError(field = "startDate"): ZodError {
    return ValidationMockFactory.zodError(
      field,
      `${field} must be in YYYY-MM-DD format`,
    );
  }
}

/**
 * Helper for setting up common mock scenarios
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Test utilities pattern
export class MockScenarioFactory {
  /**
   * Set up successful prefecture lookup scenario
   */
  static successfulPrefectureLookup(
    touringIndexRepo: any,
    prefectures: Prefecture[] = PrefectureFixture.list(),
  ) {
    touringIndexRepo.getAllPrefectures.mockResolvedValue(prefectures);
    return prefectures[0]; // Return first prefecture as the "nearest"
  }

  /**
   * Set up successful history data scenario
   */
  static successfulHistoryData(
    touringIndexRepo: any,
    prefectureId = 13,
    dates: string[] = ["2025-06-01", "2025-06-02"],
  ) {
    const historyData = ApiResponseFixture.touringIndexHistory(
      prefectureId,
      dates,
    );
    touringIndexRepo.getTouringIndexByPrefectureAndDateRange.mockResolvedValue(
      historyData,
    );
    return historyData;
  }

  /**
   * Set up successful batch processing scenario
   */
  static successfulBatchProcessing(
    weatherRepo: any,
    touringIndexRepo: any,
    prefectures: Prefecture[] = PrefectureFixture.list(),
  ) {
    // Mock weather repository
    weatherRepo.getWeatherBatch.mockResolvedValue([
      { datetime: "2025-06-01T12:00:00Z", condition: "clear", temperature: 22 },
    ]);

    // Mock touring index repository
    touringIndexRepo.getAllPrefectures.mockResolvedValue(prefectures);
    touringIndexRepo.upsertTouringIndex.mockResolvedValue();

    return { prefectures };
  }

  /**
   * Set up database error scenario
   */
  static databaseError(repo: any, method = "getAllPrefectures") {
    repo[method].mockRejectedValue(new Error("Database connection failed"));
  }

  /**
   * Set up external API error scenario
   */
  static externalApiError(weatherRepo: any) {
    const error = ExternalApiMockFactory.axiosError(500, "External API failed");
    weatherRepo.getWeather.mockRejectedValue(error);
    weatherRepo.getWeatherBatch.mockRejectedValue(error);
  }

  /**
   * Set up validation error scenario
   */
  static validationError(schema: any, field: string, message: string) {
    const error = ValidationMockFactory.zodError(field, message);
    schema.parse.mockImplementation(() => {
      throw error;
    });
    return error;
  }
}

/**
 * Response assertion helpers
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Test utilities pattern
export class ResponseAssertions {
  /**
   * Assert successful response
   */
  static assertSuccess(context: any, expectedStatus: number = HTTP_STATUS.OK) {
    const response = context._testResponse;
    expect(response.status).toBe(expectedStatus);
    expect(response.data.error).toBeUndefined();
  }

  /**
   * Assert error response
   */
  static assertError(
    context: any,
    expectedStatus: number,
    expectedErrorMessage?: string,
  ) {
    const response = context._testResponse;
    expect(response.status).toBe(expectedStatus);
    expect(response.data.error).toBeDefined();
    if (expectedErrorMessage) {
      expect(response.data.error).toContain(expectedErrorMessage);
    }
  }

  /**
   * Assert validation error response
   */
  static assertValidationError(context: any, field?: string) {
    ResponseAssertions.assertError(context, HTTP_STATUS.BAD_REQUEST);
    const response = context._testResponse;
    expect(response.data.details || response.data.error).toBeDefined();
    if (field) {
      const errorText = JSON.stringify(response.data);
      expect(errorText).toContain(field);
    }
  }

  /**
   * Assert internal server error
   */
  static assertInternalServerError(context: any) {
    ResponseAssertions.assertError(context, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }

  /**
   * Assert response has required fields
   */
  static assertHasFields(context: any, fields: string[]) {
    const response = context._testResponse;
    fields.forEach((field) => {
      expect(response.data[field]).toBeDefined();
    });
  }

  /**
   * Assert response data matches expected structure
   */
  static assertStructure(context: any, expectedStructure: any) {
    const response = context._testResponse;
    Object.keys(expectedStructure).forEach((key) => {
      expect(response.data[key]).toEqual(expectedStructure[key]);
    });
  }
}
