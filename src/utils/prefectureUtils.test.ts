import { describe, expect, test } from "bun:test";
import {
  type Prefecture,
  calculateDistance,
  findNearestPrefecture,
} from "./prefectureUtils";

describe("prefectureUtils", () => {
  const mockPrefectures: Prefecture[] = [
    {
      id: 13,
      name_ja: "東京都",
      name_en: "Tokyo",
      latitude: 35.6762,
      longitude: 139.6503,
    },
    {
      id: 14,
      name_ja: "神奈川県",
      name_en: "Kanagawa",
      latitude: 35.4478,
      longitude: 139.6425,
    },
    {
      id: 27,
      name_ja: "大阪府",
      name_en: "Osaka",
      latitude: 34.6937,
      longitude: 135.5023,
    },
  ];

  describe("calculateDistance", () => {
    test("should calculate distance between Tokyo and Osaka correctly", () => {
      const tokyoLat = 35.6762;
      const tokyoLon = 139.6503;
      const osakaLat = 34.6937;
      const osakaLon = 135.5023;

      const distance = calculateDistance(
        tokyoLat,
        tokyoLon,
        osakaLat,
        osakaLon,
      );

      // Distance between Tokyo and Osaka is approximately 400km
      expect(distance).toBeGreaterThan(390);
      expect(distance).toBeLessThan(410);
    });

    test("should return 0 for same coordinates", () => {
      const distance = calculateDistance(35.6762, 139.6503, 35.6762, 139.6503);
      expect(distance).toBe(0);
    });

    test("should handle negative coordinates", () => {
      const distance = calculateDistance(
        -35.6762,
        -139.6503,
        35.6762,
        139.6503,
      );
      expect(distance).toBeGreaterThan(0);
    });
  });

  describe("findNearestPrefecture", () => {
    test("should find Tokyo as nearest to Tokyo coordinates", () => {
      const nearest = findNearestPrefecture(35.6762, 139.6503, mockPrefectures);
      expect(nearest.id).toBe(13);
      expect(nearest.name_en).toBe("Tokyo");
    });

    test("should find Kanagawa as nearest to coordinates between Tokyo and Kanagawa", () => {
      // Coordinates closer to Kanagawa
      const nearest = findNearestPrefecture(35.45, 139.64, mockPrefectures);
      expect(nearest.id).toBe(14);
      expect(nearest.name_en).toBe("Kanagawa");
    });

    test("should find Osaka as nearest to Osaka coordinates", () => {
      const nearest = findNearestPrefecture(34.6937, 135.5023, mockPrefectures);
      expect(nearest.id).toBe(27);
      expect(nearest.name_en).toBe("Osaka");
    });

    test("should throw error when no prefectures provided", () => {
      expect(() => findNearestPrefecture(35.6762, 139.6503, [])).toThrow(
        "No prefectures provided",
      );
    });

    test("should return single prefecture when only one provided", () => {
      const singlePrefecture = [mockPrefectures[0]];
      const nearest = findNearestPrefecture(0, 0, singlePrefecture);
      expect(nearest.id).toBe(13);
      expect(nearest.name_en).toBe("Tokyo");
    });
  });
});
