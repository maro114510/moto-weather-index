import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
  batchParametersSchema,
  getTouringIndexHistorySchema,
  getTouringIndexSchema,
} from "./touringIndexSchemas";

describe("touringIndexSchemas", () => {
  describe("getTouringIndexSchema", () => {
    test("should validate valid coordinates", () => {
      const validInput = {
        lat: "35.6762",
        lon: "139.6503",
        datetime: "2024-06-01T12:00:00Z",
      };

      const result = getTouringIndexSchema.parse(validInput);
      expect(result.lat).toBe(35.6762);
      expect(result.lon).toBe(139.6503);
      expect(result.datetime).toBe("2024-06-01T12:00:00Z");
    });

    test("should allow optional datetime", () => {
      const validInput = {
        lat: "35.6762",
        lon: "139.6503",
      };

      const result = getTouringIndexSchema.parse(validInput);
      expect(result.lat).toBe(35.6762);
      expect(result.lon).toBe(139.6503);
      expect(result.datetime).toBeUndefined();
    });

    test("should reject invalid latitude", () => {
      const invalidInput = {
        lat: "invalid",
        lon: "139.6503",
      };

      expect(() => getTouringIndexSchema.parse(invalidInput)).toThrow(
        "lat must be a valid number",
      );
    });

    test("should reject latitude out of range", () => {
      const invalidInput = {
        lat: "91", // > 90
        lon: "139.6503",
      };

      expect(() => getTouringIndexSchema.parse(invalidInput)).toThrow(
        "lat must be between -90 and 90",
      );
    });

    test("should reject invalid longitude", () => {
      const invalidInput = {
        lat: "35.6762",
        lon: "invalid",
      };

      expect(() => getTouringIndexSchema.parse(invalidInput)).toThrow(
        "lon must be a valid number",
      );
    });

    test("should reject longitude out of range", () => {
      const invalidInput = {
        lat: "35.6762",
        lon: "181", // > 180
      };

      expect(() => getTouringIndexSchema.parse(invalidInput)).toThrow(
        "lon must be between -180 and 180",
      );
    });
  });

  describe("getTouringIndexHistorySchema", () => {
    test("should validate valid input with all parameters", () => {
      const validInput = {
        lat: "35.6762",
        lon: "139.6503",
        startDate: "2024-05-25",
        endDate: "2024-06-01",
        prefectureId: "13",
      };

      const result = getTouringIndexHistorySchema.parse(validInput);
      expect(result.lat).toBe(35.6762);
      expect(result.lon).toBe(139.6503);
      expect(result.startDate).toBe("2024-05-25");
      expect(result.endDate).toBe("2024-06-01");
      expect(result.prefectureId).toBe(13);
    });

    test("should use default values for optional parameters", () => {
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const expectedStartDate = sevenDaysAgo.toISOString().split("T")[0];
      const expectedEndDate = today.toISOString().split("T")[0];

      const validInput = {
        lat: "35.6762",
        lon: "139.6503",
      };

      const result = getTouringIndexHistorySchema.parse(validInput);
      expect(result.lat).toBe(35.6762);
      expect(result.lon).toBe(139.6503);
      expect(result.startDate).toBe(expectedStartDate);
      expect(result.endDate).toBe(expectedEndDate);
      expect(result.prefectureId).toBeUndefined();
    });

    test("should validate coordinates ranges", () => {
      const validInput = {
        lat: "-89.9999",
        lon: "-179.9999",
        startDate: "2024-05-25",
        endDate: "2024-06-01",
      };

      const result = getTouringIndexHistorySchema.parse(validInput);
      expect(result.lat).toBe(-89.9999);
      expect(result.lon).toBe(-179.9999);
    });

    test("should reject invalid date format", () => {
      const invalidInput = {
        lat: "35.6762",
        lon: "139.6503",
        startDate: "2024/05/25", // Wrong format
      };

      expect(() => getTouringIndexHistorySchema.parse(invalidInput)).toThrow(
        "startDate must be in YYYY-MM-DD format",
      );
    });

    test("should reject invalid date", () => {
      const invalidInput = {
        lat: "35.6762",
        lon: "139.6503",
        startDate: "2024-13-99", // Invalid date
      };

      expect(() => getTouringIndexHistorySchema.parse(invalidInput)).toThrow(
        "startDate must be a valid date",
      );
    });

    test("should reject invalid prefecture ID", () => {
      const invalidInput = {
        lat: "35.6762",
        lon: "139.6503",
        prefectureId: "48", // > 47
      };

      expect(() => getTouringIndexHistorySchema.parse(invalidInput)).toThrow(
        "prefectureId must be between 1 and 47",
      );
    });

    test("should reject prefecture ID of 0", () => {
      const invalidInput = {
        lat: "35.6762",
        lon: "139.6503",
        prefectureId: "0",
      };

      expect(() => getTouringIndexHistorySchema.parse(invalidInput)).toThrow(
        "prefectureId must be between 1 and 47",
      );
    });

    test("should reject non-numeric prefecture ID", () => {
      const invalidInput = {
        lat: "35.6762",
        lon: "139.6503",
        prefectureId: "tokyo",
      };

      expect(() => getTouringIndexHistorySchema.parse(invalidInput)).toThrow(
        "prefectureId must be between 1 and 47",
      );
    });

    test("should accept boundary values for coordinates", () => {
      const boundaryInput = {
        lat: "90", // Max latitude
        lon: "180", // Max longitude
      };

      const result = getTouringIndexHistorySchema.parse(boundaryInput);
      expect(result.lat).toBe(90);
      expect(result.lon).toBe(180);
    });

    test("should accept boundary values for prefecture ID", () => {
      const boundaryInput = {
        lat: "35.6762",
        lon: "139.6503",
        prefectureId: "1", // Min prefecture ID
      };

      const result = getTouringIndexHistorySchema.parse(boundaryInput);
      expect(result.prefectureId).toBe(1);

      const maxBoundaryInput = {
        lat: "35.6762",
        lon: "139.6503",
        prefectureId: "47", // Max prefecture ID
      };

      const maxResult = getTouringIndexHistorySchema.parse(maxBoundaryInput);
      expect(maxResult.prefectureId).toBe(47);
    });

    test("should handle leap year dates correctly", () => {
      const leapYearInput = {
        lat: "35.6762",
        lon: "139.6503",
        startDate: "2024-02-29", // Leap year
        endDate: "2024-03-01",
      };

      const result = getTouringIndexHistorySchema.parse(leapYearInput);
      expect(result.startDate).toBe("2024-02-29");
      expect(result.endDate).toBe("2024-03-01");
    });

    test("should reject invalid leap year dates", () => {
      const invalidLeapYearInput = {
        lat: "35.6762",
        lon: "139.6503",
        startDate: "2023-02-29", // Not a leap year
      };

      expect(() =>
        getTouringIndexHistorySchema.parse(invalidLeapYearInput),
      ).toThrow("startDate must be a valid date");
    });
  });

  describe("batchParametersSchema", () => {
    test("should use default values when parameters not provided", () => {
      const emptyInput = {};
      const result = batchParametersSchema.parse(emptyInput);

      expect(result.days).toBe(16);
      expect(result.maxRetries).toBe(3);
    });

    test("should parse valid string parameters", () => {
      const validInput = {
        days: "7",
        maxRetries: "5",
      };

      const result = batchParametersSchema.parse(validInput);
      expect(result.days).toBe(7);
      expect(result.maxRetries).toBe(5);
    });

    test("should reject days out of range", () => {
      const invalidInput = {
        days: "31", // > 30
      };

      expect(() => batchParametersSchema.parse(invalidInput)).toThrow(
        "days parameter must be between 1 and 30",
      );
    });

    test("should reject maxRetries out of range", () => {
      const invalidInput = {
        maxRetries: "11", // > 10
      };

      expect(() => batchParametersSchema.parse(invalidInput)).toThrow(
        "maxRetries parameter must be between 1 and 10",
      );
    });

    test("should reject zero values", () => {
      expect(() => batchParametersSchema.parse({ days: "0" })).toThrow(
        "days parameter must be between 1 and 30",
      );

      expect(() => batchParametersSchema.parse({ maxRetries: "0" })).toThrow(
        "maxRetries parameter must be between 1 and 10",
      );
    });

    test("should accept boundary values", () => {
      const boundaryInput = {
        days: "1", // Min
        maxRetries: "1", // Min
      };

      const result = batchParametersSchema.parse(boundaryInput);
      expect(result.days).toBe(1);
      expect(result.maxRetries).toBe(1);

      const maxBoundaryInput = {
        days: "30", // Max
        maxRetries: "10", // Max
      };

      const maxResult = batchParametersSchema.parse(maxBoundaryInput);
      expect(maxResult.days).toBe(30);
      expect(maxResult.maxRetries).toBe(10);
    });
  });
});
