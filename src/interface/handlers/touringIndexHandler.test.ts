import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Context } from "hono";
import { ZodError, z } from "zod";
import { HTTP_STATUS } from "../../constants/httpStatus";
import { getTouringIndexHistory } from "./touringIndexHandler";

// Mock dependencies
const mockCreateTouringIndexRepository = mock();
const mockValidateDateRange = mock();
const mockFindNearestPrefecture = mock();
const mockCalculateDistance = mock();

// Mock the schemas to control validation
const mockGetTouringIndexHistorySchema = {
  parse: mock(),
};

// Mock modules
mock.module("../../di/container", () => ({
  createTouringIndexRepository: mockCreateTouringIndexRepository,
}));

mock.module("../../utils/dateUtils", () => ({
  validateDateRange: mockValidateDateRange,
}));

mock.module("../../utils/prefectureUtils", () => ({
  findNearestPrefecture: mockFindNearestPrefecture,
  calculateDistance: mockCalculateDistance,
}));

mock.module("../../dao/touringIndexSchemas", () => ({
  getTouringIndexHistorySchema: mockGetTouringIndexHistorySchema,
}));

// Helper to create a proper query mock that satisfies Hono's query interface
function createQueryMock(params: Record<string, string>) {
  const queryMock = mock((key?: string) => {
    if (key === undefined) {
      return params;
    }
    return params[key];
  });

  // Add the overload for no parameters
  Object.assign(
    queryMock,
    mock(() => params),
  );

  return queryMock as any;
}

// Global variable to capture response data
let capturedResponse: { data: any; status: number } = { data: {}, status: 200 };

describe("getTouringIndexHistory", () => {
  let mockContext: Partial<Context>;
  let mockTouringIndexRepo: any;

  beforeEach(() => {
    // Reset all mocks
    mockCreateTouringIndexRepository.mockClear();
    mockValidateDateRange.mockClear();
    mockFindNearestPrefecture.mockClear();
    mockCalculateDistance.mockClear();
    mockGetTouringIndexHistorySchema.parse.mockClear();

    // Reset captured response
    capturedResponse = { data: {}, status: 200 };

    // Mock context with simplified json function
    mockContext = {
      get: mock(() => ({})),
      req: {
        query: undefined as any, // Will be set per test
      } as any,
      json: mock((data: any, status?: any) => {
        capturedResponse.data = data;
        capturedResponse.status = status || 200;
        return {} as any; // Return empty object to satisfy type
      }) as any,
      env: {
        DB: {
          /* mock D1 database */
        },
      } as any,
    };

    // Mock repository
    mockTouringIndexRepo = {
      getAllPrefectures: mock(),
      getTouringIndexByPrefectureAndDateRange: mock(),
    };

    mockCreateTouringIndexRepository.mockReturnValue(mockTouringIndexRepo);

    // Set up default successful schema parsing
    mockGetTouringIndexHistorySchema.parse = mock((input) => ({
      lat: Number(input.lat),
      lon: Number(input.lon),
      startDate: input.startDate || "2025-05-26",
      endDate: input.endDate || "2025-06-02",
      prefectureId: input.prefectureId ? Number(input.prefectureId) : undefined,
    }));
  });

  describe("successful cases", () => {
    test("should return history data with auto-detected prefecture", async () => {
      // Setup
      const mockPrefectures = [
        {
          id: 13,
          name_ja: "東京都",
          name_en: "Tokyo",
          latitude: 35.6762,
          longitude: 139.6503,
        },
      ];

      const mockHistoryData = [
        {
          id: 1,
          prefecture_id: 13,
          date: "2024-06-01",
          score: 85.5,
          weather_factors_json: JSON.stringify({
            temperature: 20,
            weather: 25,
            wind: 15,
          }),
          weather_raw_json: JSON.stringify({
            condition: "clear",
            temperature: 25.5,
            windSpeed: 5.2,
          }),
          calculated_at: "2024-06-01T06:00:00Z",
        },
      ];

      (mockContext.req as any).query = createQueryMock({
        lat: "35.6762",
        lon: "139.6503",
        startDate: "2024-05-25",
        endDate: "2024-06-01",
      });

      mockGetTouringIndexHistorySchema.parse.mockReturnValue({
        lat: 35.6762,
        lon: 139.6503,
        startDate: "2024-05-25",
        endDate: "2024-06-01",
        prefectureId: undefined,
      });

      mockValidateDateRange.mockImplementation(() => {});
      mockTouringIndexRepo.getAllPrefectures.mockResolvedValue(mockPrefectures);
      mockFindNearestPrefecture.mockReturnValue(mockPrefectures[0]);
      mockCalculateDistance.mockReturnValue(5.2);
      mockTouringIndexRepo.getTouringIndexByPrefectureAndDateRange.mockResolvedValue(
        mockHistoryData,
      );

      // Execute
      await getTouringIndexHistory(mockContext as Context);

      // Verify
      expect(mockValidateDateRange).toHaveBeenCalledWith(
        "2024-05-25",
        "2024-06-01",
      );
      expect(mockTouringIndexRepo.getAllPrefectures).toHaveBeenCalled();
      expect(mockFindNearestPrefecture).toHaveBeenCalledWith(
        35.6762,
        139.6503,
        mockPrefectures,
      );
      expect(
        mockTouringIndexRepo.getTouringIndexByPrefectureAndDateRange,
      ).toHaveBeenCalledWith(13, "2024-05-25", "2024-06-01");

      expect(capturedResponse.data.location).toEqual({
        lat: 35.6762,
        lon: 139.6503,
      });
      expect(capturedResponse.data.prefecture_id).toBe(13);
      expect(capturedResponse.data.data).toHaveLength(1);
      expect(capturedResponse.data.data[0].date).toBe("2024-06-01");
      expect(capturedResponse.data.data[0].score).toBe(85.5);
      expect(capturedResponse.status).toBe(HTTP_STATUS.OK);
    });

    test("should return history data with specified prefectureId", async () => {
      const mockHistoryData = [
        {
          id: 1,
          prefecture_id: 27,
          date: "2024-06-01",
          score: 75.0,
          weather_factors_json: JSON.stringify({ temperature: 18 }),
          weather_raw_json: JSON.stringify({ condition: "cloudy" }),
          calculated_at: "2024-06-01T06:00:00Z",
        },
      ];

      (mockContext.req as any).query = createQueryMock({
        lat: "35.6762",
        lon: "139.6503",
        prefectureId: "27",
        startDate: "2024-05-25",
        endDate: "2024-06-01",
      });

      mockGetTouringIndexHistorySchema.parse.mockReturnValue({
        lat: 35.6762,
        lon: 139.6503,
        startDate: "2024-05-25",
        endDate: "2024-06-01",
        prefectureId: 27,
      });

      mockValidateDateRange.mockImplementation(() => {});
      mockTouringIndexRepo.getTouringIndexByPrefectureAndDateRange.mockResolvedValue(
        mockHistoryData,
      );

      // Execute
      await getTouringIndexHistory(mockContext as Context);

      // Verify
      expect(mockTouringIndexRepo.getAllPrefectures).not.toHaveBeenCalled();
      expect(mockFindNearestPrefecture).not.toHaveBeenCalled();
      expect(
        mockTouringIndexRepo.getTouringIndexByPrefectureAndDateRange,
      ).toHaveBeenCalledWith(27, "2024-05-25", "2024-06-01");
      expect(capturedResponse.data.prefecture_id).toBe(27);
    });

    test("should return empty array when no data found", async () => {
      (mockContext.req as any).query = createQueryMock({
        lat: "35.6762",
        lon: "139.6503",
        prefectureId: "13",
        startDate: "2020-01-01",
        endDate: "2020-01-07",
      });

      mockGetTouringIndexHistorySchema.parse.mockReturnValue({
        lat: 35.6762,
        lon: 139.6503,
        startDate: "2020-01-01",
        endDate: "2020-01-07",
        prefectureId: 13,
      });

      mockValidateDateRange.mockImplementation(() => {});
      mockTouringIndexRepo.getTouringIndexByPrefectureAndDateRange.mockResolvedValue(
        [],
      );

      // Execute
      await getTouringIndexHistory(mockContext as Context);

      // Verify
      expect(capturedResponse.data.data).toEqual([]);
      expect(capturedResponse.status).toBe(HTTP_STATUS.OK);
    });

    test("should use default date range when not provided", async () => {
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const expectedStartDate = sevenDaysAgo.toISOString().split("T")[0];
      const expectedEndDate = today.toISOString().split("T")[0];

      (mockContext.req as any).query = createQueryMock({
        lat: "35.6762",
        lon: "139.6503",
        prefectureId: "13",
      });

      mockGetTouringIndexHistorySchema.parse.mockReturnValue({
        lat: 35.6762,
        lon: 139.6503,
        startDate: expectedStartDate,
        endDate: expectedEndDate,
        prefectureId: 13,
      });

      mockValidateDateRange.mockImplementation(() => {});
      mockTouringIndexRepo.getTouringIndexByPrefectureAndDateRange.mockResolvedValue(
        [],
      );

      // Execute
      await getTouringIndexHistory(mockContext as Context);

      // Verify that default dates were used
      expect(mockValidateDateRange).toHaveBeenCalledWith(
        expectedStartDate,
        expectedEndDate,
      );
      expect(
        mockTouringIndexRepo.getTouringIndexByPrefectureAndDateRange,
      ).toHaveBeenCalledWith(13, expectedStartDate, expectedEndDate);
    });
  });

  describe("error cases", () => {
    test("should return 400 for invalid latitude", async () => {
      (mockContext.req as any).query = createQueryMock({
        lat: "invalid",
        lon: "139.6503",
      });

      // Mock ZodError for invalid latitude
      const zodError = new ZodError([
        {
          code: "custom",
          path: ["lat"],
          message: "lat must be a valid number",
        },
      ]);

      mockGetTouringIndexHistorySchema.parse.mockImplementation(() => {
        throw zodError;
      });

      // Execute
      await getTouringIndexHistory(mockContext as Context);

      // Verify
      expect(capturedResponse.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(capturedResponse.data.error).toContain(
        "lat must be a valid number",
      );
    });

    test("should return 400 for invalid longitude", async () => {
      (mockContext.req as any).query = createQueryMock({
        lat: "35.6762",
        lon: "200", // Invalid longitude
      });

      // Mock ZodError for invalid longitude
      const zodError = new ZodError([
        {
          code: "custom",
          path: ["lon"],
          message: "lon must be between -180 and 180",
        },
      ]);

      mockGetTouringIndexHistorySchema.parse.mockImplementation(() => {
        throw zodError;
      });

      // Execute
      await getTouringIndexHistory(mockContext as Context);

      // Verify
      expect(capturedResponse.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(capturedResponse.data.error).toContain(
        "lon must be between -180 and 180",
      );
    });

    test("should return 400 for invalid prefectureId", async () => {
      (mockContext.req as any).query = createQueryMock({
        lat: "35.6762",
        lon: "139.6503",
        prefectureId: "50", // Invalid prefecture ID
      });

      // Mock ZodError for invalid prefectureId
      const zodError = new ZodError([
        {
          code: "custom",
          path: ["prefectureId"],
          message: "prefectureId must be between 1 and 47",
        },
      ]);

      mockGetTouringIndexHistorySchema.parse.mockImplementation(() => {
        throw zodError;
      });

      // Execute
      await getTouringIndexHistory(mockContext as Context);

      // Verify
      expect(capturedResponse.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(capturedResponse.data.error).toContain(
        "prefectureId must be between 1 and 47",
      );
    });

    test("should return 400 for invalid date format", async () => {
      (mockContext.req as any).query = createQueryMock({
        lat: "35.6762",
        lon: "139.6503",
        startDate: "invalid-date",
      });

      // Mock ZodError for invalid date format
      const zodError = new ZodError([
        {
          code: "custom",
          path: ["startDate"],
          message: "startDate must be in YYYY-MM-DD format",
        },
      ]);

      mockGetTouringIndexHistorySchema.parse.mockImplementation(() => {
        throw zodError;
      });

      // Execute
      await getTouringIndexHistory(mockContext as Context);

      // Verify
      expect(capturedResponse.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(capturedResponse.data.error).toContain(
        "startDate must be in YYYY-MM-DD format",
      );
    });

    test("should return 400 for invalid date range", async () => {
      (mockContext.req as any).query = createQueryMock({
        lat: "35.6762",
        lon: "139.6503",
        startDate: "2024-06-01",
        endDate: "2024-05-25",
      });

      mockGetTouringIndexHistorySchema.parse.mockReturnValue({
        lat: 35.6762,
        lon: 139.6503,
        startDate: "2024-06-01",
        endDate: "2024-05-25",
        prefectureId: undefined,
      });

      mockValidateDateRange.mockImplementation(() => {
        throw new Error("startDate must be before endDate");
      });

      // Execute
      await getTouringIndexHistory(mockContext as Context);

      // Verify
      expect(capturedResponse.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(capturedResponse.data.error).toBe(
        "startDate must be before endDate",
      );
    });

    test("should return 400 for date range exceeding 16 days in future", async () => {
      const today = new Date();
      const in20Days = new Date(today);
      in20Days.setDate(in20Days.getDate() + 20);

      (mockContext.req as any).query = createQueryMock({
        lat: "35.6762",
        lon: "139.6503",
        startDate: today.toISOString().split("T")[0],
        endDate: in20Days.toISOString().split("T")[0],
      });

      mockGetTouringIndexHistorySchema.parse.mockReturnValue({
        lat: 35.6762,
        lon: 139.6503,
        startDate: today.toISOString().split("T")[0],
        endDate: in20Days.toISOString().split("T")[0],
        prefectureId: undefined,
      });

      mockValidateDateRange.mockImplementation(() => {
        throw new Error("endDate cannot be more than 16 days in the future");
      });

      // Execute
      await getTouringIndexHistory(mockContext as Context);

      // Verify
      expect(capturedResponse.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(capturedResponse.data.error).toBe(
        "endDate cannot be more than 16 days in the future",
      );
    });

    test("should return 500 when database is not available", async () => {
      mockContext.env = {}; // No DB

      (mockContext.req as any).query = createQueryMock({
        lat: "35.6762",
        lon: "139.6503",
      });

      mockGetTouringIndexHistorySchema.parse.mockReturnValue({
        lat: 35.6762,
        lon: 139.6503,
        startDate: "2025-05-26",
        endDate: "2025-06-02",
        prefectureId: undefined,
      });

      mockValidateDateRange.mockImplementation(() => {});

      // Execute
      await getTouringIndexHistory(mockContext as Context);

      // Verify
      expect(capturedResponse.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(capturedResponse.data.error).toBe("Database not available");
    });

    test("should return 500 when repository throws error", async () => {
      (mockContext.req as any).query = createQueryMock({
        lat: "35.6762",
        lon: "139.6503",
        prefectureId: "13",
      });

      mockGetTouringIndexHistorySchema.parse.mockReturnValue({
        lat: 35.6762,
        lon: 139.6503,
        startDate: "2025-05-26",
        endDate: "2025-06-02",
        prefectureId: 13,
      });

      mockValidateDateRange.mockImplementation(() => {});
      mockTouringIndexRepo.getTouringIndexByPrefectureAndDateRange.mockRejectedValue(
        new Error("Database connection failed"),
      );

      // Execute
      await getTouringIndexHistory(mockContext as Context);

      // Verify
      expect(capturedResponse.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(capturedResponse.data.error).toBe("Internal server error");
    });

    test("should handle invalid JSON in weather data gracefully", async () => {
      const mockHistoryData = [
        {
          id: 1,
          prefecture_id: 13,
          date: "2024-06-01",
          score: 85.5,
          weather_factors_json: "invalid json",
          weather_raw_json: "also invalid",
          calculated_at: "2024-06-01T06:00:00Z",
        },
      ];

      (mockContext.req as any).query = createQueryMock({
        lat: "35.6762",
        lon: "139.6503",
        prefectureId: "13",
      });

      mockGetTouringIndexHistorySchema.parse.mockReturnValue({
        lat: 35.6762,
        lon: 139.6503,
        startDate: "2025-05-26",
        endDate: "2025-06-02",
        prefectureId: 13,
      });

      mockValidateDateRange.mockImplementation(() => {});
      mockTouringIndexRepo.getTouringIndexByPrefectureAndDateRange.mockResolvedValue(
        mockHistoryData,
      );

      // Execute
      await getTouringIndexHistory(mockContext as Context);

      // Verify that it still returns data with empty objects for invalid JSON
      expect(capturedResponse.status).toBe(HTTP_STATUS.OK);
      expect(capturedResponse.data.data[0].factors).toEqual({});
    });
  });
});
