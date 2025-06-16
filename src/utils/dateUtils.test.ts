import { describe, expect, test } from "bun:test";
import { validateBatchStartDate, validateDateRange } from "./dateUtils";

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

    test("should reject when endDate is more than 16 days in the future", () => {
      const today = new Date();
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + 20);

      const startDate = today.toISOString().split("T")[0];
      const endDate = futureDate.toISOString().split("T")[0];

      expect(() => validateDateRange(startDate, endDate)).toThrow(
        "endDate cannot be more than 16 days in the future",
      );
    });

    test("should accept endDate exactly 16 days in the future", () => {
      const today = new Date();
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + 16);

      const startDate = today.toISOString().split("T")[0];
      const endDate = futureDate.toISOString().split("T")[0];

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
  });

  describe("validateBatchStartDate", () => {
    test("should accept today as start date", () => {
      const today = new Date().toISOString().split("T")[0];

      expect(() => validateBatchStartDate(today)).not.toThrow();
    });

    test("should accept date within last 7 days", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 3); // 3 days ago
      const dateString = pastDate.toISOString().split("T")[0];

      expect(() => validateBatchStartDate(dateString)).not.toThrow();
    });

    test("should accept exactly 7 days ago", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7);
      const dateString = pastDate.toISOString().split("T")[0];

      expect(() => validateBatchStartDate(dateString)).not.toThrow();
    });

    test("should reject date older than 7 days", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 8);
      const dateString = pastDate.toISOString().split("T")[0];

      expect(() => validateBatchStartDate(dateString)).toThrow(
        "Batch start date must be within the last 7 days",
      );
    });

    test("should accept future date within 16 days", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      const dateString = futureDate.toISOString().split("T")[0];

      expect(() => validateBatchStartDate(dateString)).not.toThrow();
    });

    test("should accept exactly 16 days in the future", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 16);
      const dateString = futureDate.toISOString().split("T")[0];

      expect(() => validateBatchStartDate(dateString)).not.toThrow();
    });

    test("should reject date more than 16 days in the future", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 17);
      const dateString = futureDate.toISOString().split("T")[0];

      expect(() => validateBatchStartDate(dateString)).toThrow(
        "Batch start date cannot be more than 16 days in the future",
      );
    });
  });
});
