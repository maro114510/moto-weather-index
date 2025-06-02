// src/interface/handlers/prefectureHandler.test.ts
import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Context } from "hono";
import { HTTP_STATUS } from "../../constants/httpStatus";
import { getPrefectures } from "./prefectureHandler";

// Mock dependencies
const mockCreateTouringIndexRepository = mock();

// Mock modules
mock.module("../../di/container", () => ({
  createTouringIndexRepository: mockCreateTouringIndexRepository,
}));

mock.module("../../infra/D1TouringIndexRepository", () => ({
  D1TouringIndexRepository: mock(),
}));

mock.module("../../utils/logger", () => ({
  logger: {
    info: mock(),
    error: mock(),
    debug: mock(),
    warn: mock(),
    businessLogic: mock(),
  },
}));

// Global variable to capture response data
let capturedResponse: { data: any; status: number } = { data: {}, status: 200 };

describe("prefectureHandler", () => {
  let mockContext: Partial<Context>;
  let mockRepo: any;

  beforeEach(() => {
    // Reset all mocks
    mockCreateTouringIndexRepository.mockClear();

    // Reset captured response
    capturedResponse = { data: {}, status: 200 };

    // Mock context with simplified json function
    mockContext = {
      get: mock(() => ({})),
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
    mockRepo = {
      getAllPrefectures: mock(),
    };

    mockCreateTouringIndexRepository.mockReturnValue(mockRepo);
  });

  describe("getPrefectures", () => {
    test("should return list of prefectures", async () => {
      // Mock data
      const mockPrefectures = [
        {
          id: 1,
          name_ja: "北海道",
          name_en: "Hokkaido",
          latitude: 43.06417,
          longitude: 141.34694,
        },
        {
          id: 13,
          name_ja: "東京都",
          name_en: "Tokyo",
          latitude: 35.6895,
          longitude: 139.6917,
        },
      ];

      mockRepo.getAllPrefectures.mockResolvedValue(mockPrefectures);

      // Call the handler
      await getPrefectures(mockContext as Context);

      // Verify that getAllPrefectures was called
      expect(mockRepo.getAllPrefectures).toHaveBeenCalledTimes(1);

      // Verify the response
      expect(capturedResponse.data).toEqual({
        prefectures: mockPrefectures,
        count: mockPrefectures.length,
      });
      expect(capturedResponse.status).toBe(HTTP_STATUS.OK);
    });

    test("should return 500 when database is not available", async () => {
      // Mock Hono context without DB
      mockContext.env = {};

      // Call the handler
      await getPrefectures(mockContext as Context);

      // Verify the response is an error
      expect(capturedResponse.data).toEqual({ error: "Database not available" });
      expect(capturedResponse.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    });

    test("should return 500 when an error occurs", async () => {
      // Mock repository that throws an error
      mockRepo.getAllPrefectures.mockRejectedValue(new Error("Database error"));

      // Call the handler
      await getPrefectures(mockContext as Context);

      // Verify that getAllPrefectures was called
      expect(mockRepo.getAllPrefectures).toHaveBeenCalledTimes(1);

      // Verify the response is an error
      expect(capturedResponse.data).toEqual({ error: "Internal server error" });
      expect(capturedResponse.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    });
  });
});
