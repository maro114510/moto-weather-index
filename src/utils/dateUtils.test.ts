import { describe, expect, test } from "bun:test";
import { APP_CONFIG } from "../constants/appConfig";
import {
  addDaysToDateString,
  getJstDateString,
  validateBatchStartDate,
  validateDateRange,
} from "./dateUtils";

const MAX_FUTURE_DAYS = APP_CONFIG.MAX_FORECAST_DAYS - 1;

describe("dateUtils", () => {
  describe("validateDateRange", () => {
    test("should accept valid date range within 30 days", () => {
      const startDate = "2024-06-01";
      const endDate = "2024-06-15";

      expect(() => validateDateRange(startDate, endDate)).not.toThrow();
    });

    test("should accept exactly 30 days range", () => {
      const startDate = "2024-06-01";
      const endDate = "2024-07-01";

      expect(() => validateDateRange(startDate, endDate)).not.toThrow();
    });

    test("should reject when date range exceeds 30 days", () => {
      const startDate = "2024-06-01";
      const endDate = "2024-07-02";

      expect(() => validateDateRange(startDate, endDate)).toThrow(
        "Date range cannot exceed 30 days",
      );
    });

    test("should reject when startDate is after endDate", () => {
      const startDate = "2024-06-15";
      const endDate = "2024-06-01";

      expect(() => validateDateRange(startDate, endDate)).toThrow(
        "startDate must be before endDate",
      );
    });

    test("should reject when endDate is more than the forecast window in the future", () => {
      const today = getJstDateString();
      const startDate = today;
      const endDate = addDaysToDateString(today, MAX_FUTURE_DAYS + 4);

      expect(() => validateDateRange(startDate, endDate)).toThrow(
        `endDate cannot be more than ${MAX_FUTURE_DAYS} days in the future`,
      );
    });

    test("should accept endDate exactly at the forecast window boundary", () => {
      const today = getJstDateString();
      const startDate = today;
      const endDate = addDaysToDateString(today, MAX_FUTURE_DAYS);

      expect(() => validateDateRange(startDate, endDate)).not.toThrow();
    });

    test("should accept very old dates (no past date restriction)", () => {
      const startDate = "2020-01-01";
      const endDate = "2020-01-07";

      expect(() => validateDateRange(startDate, endDate)).not.toThrow();
    });

    test("should accept same start and end date", () => {
      const date = "2024-06-01";

      expect(() => validateDateRange(date, date)).not.toThrow();
    });

    test("should reject invalid startDate format", () => {
      expect(() => validateDateRange("2024/06/01", "2024-06-02")).toThrow(
        "startDate must be in YYYY-MM-DD format",
      );
      expect(() => validateDateRange("24-06-01", "2024-06-02")).toThrow(
        "startDate must be in YYYY-MM-DD format",
      );
      expect(() => validateDateRange("2024-6-1", "2024-06-02")).toThrow(
        "startDate must be in YYYY-MM-DD format",
      );
    });

    test("should reject invalid endDate format", () => {
      expect(() => validateDateRange("2024-06-01", "2024/06/02")).toThrow(
        "endDate must be in YYYY-MM-DD format",
      );
      expect(() => validateDateRange("2024-06-01", "24-06-02")).toThrow(
        "endDate must be in YYYY-MM-DD format",
      );
      expect(() => validateDateRange("2024-06-01", "2024-6-2")).toThrow(
        "endDate must be in YYYY-MM-DD format",
      );
    });

    test("should reject invalid dates", () => {
      expect(() => validateDateRange("2024-02-30", "2024-03-01")).toThrow(
        "startDate is not a valid date",
      );
      expect(() => validateDateRange("2024-06-01", "2024-13-01")).toThrow(
        "endDate is not a valid date",
      );
      expect(() => validateDateRange("2024-06-32", "2024-07-01")).toThrow(
        "startDate is not a valid date",
      );
    });

    test("should reject non-date strings", () => {
      expect(() => validateDateRange("not-a-date", "2024-06-01")).toThrow(
        "startDate must be in YYYY-MM-DD format",
      );
      expect(() => validateDateRange("2024-06-01", "invalid")).toThrow(
        "endDate must be in YYYY-MM-DD format",
      );
    });
  });

  describe("validateBatchStartDate", () => {
    test("should accept today as start date", () => {
      const today = getJstDateString();

      expect(() => validateBatchStartDate(today)).not.toThrow();
    });

    test("should accept date within last 7 days", () => {
      const dateString = addDaysToDateString(getJstDateString(), -3);

      expect(() => validateBatchStartDate(dateString)).not.toThrow();
    });

    test("should accept exactly 7 days ago", () => {
      const dateString = addDaysToDateString(getJstDateString(), -7);

      expect(() => validateBatchStartDate(dateString)).not.toThrow();
    });

    test("should reject date older than 7 days", () => {
      const dateString = addDaysToDateString(getJstDateString(), -8);

      expect(() => validateBatchStartDate(dateString)).toThrow(
        "Batch start date must be within the last 7 days",
      );
    });

    test("should accept future date within the forecast window", () => {
      const dateString = addDaysToDateString(getJstDateString(), 10);

      expect(() => validateBatchStartDate(dateString)).not.toThrow();
    });

    test("should accept exactly at the forecast window boundary", () => {
      const dateString = addDaysToDateString(
        getJstDateString(),
        MAX_FUTURE_DAYS,
      );

      expect(() => validateBatchStartDate(dateString)).not.toThrow();
    });

    test("should reject date beyond the forecast window", () => {
      const dateString = addDaysToDateString(
        getJstDateString(),
        MAX_FUTURE_DAYS + 1,
      );

      expect(() => validateBatchStartDate(dateString)).toThrow(
        `Batch start date cannot be more than ${MAX_FUTURE_DAYS} days in the future`,
      );
    });

    test("should reject invalid date format", () => {
      expect(() => validateBatchStartDate("2024/06/01")).toThrow(
        "startDate must be in YYYY-MM-DD format",
      );
      expect(() => validateBatchStartDate("24-06-01")).toThrow(
        "startDate must be in YYYY-MM-DD format",
      );
      expect(() => validateBatchStartDate("2024-6-1")).toThrow(
        "startDate must be in YYYY-MM-DD format",
      );
    });

    test("should reject invalid dates", () => {
      expect(() => validateBatchStartDate("2024-02-30")).toThrow(
        "startDate is not a valid date",
      );
      expect(() => validateBatchStartDate("2024-13-01")).toThrow(
        "startDate is not a valid date",
      );
      expect(() => validateBatchStartDate("2024-06-32")).toThrow(
        "startDate is not a valid date",
      );
    });

    test("should reject non-date strings", () => {
      expect(() => validateBatchStartDate("not-a-date")).toThrow(
        "startDate must be in YYYY-MM-DD format",
      );
      expect(() => validateBatchStartDate("invalid")).toThrow(
        "startDate must be in YYYY-MM-DD format",
      );
      expect(() => validateBatchStartDate("")).toThrow(
        "startDate must be in YYYY-MM-DD format",
      );
    });
  });
});
