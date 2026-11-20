import { describe, expect, test } from "bun:test";
import {
  confidenceLabel,
  factorLabel,
  formatFreshness,
  formatTarget,
  ratingClasses,
} from "./format";

describe("factorLabel", () => {
  test("names each of the eight factors in Japanese", () => {
    expect(factorLabel("weather")).toBe("天気");
    expect(factorLabel("temperature")).toBe("気温");
    expect(factorLabel("wind")).toBe("風速");
    expect(factorLabel("humidity")).toBe("湿度");
    expect(factorLabel("visibility")).toBe("視程");
    expect(factorLabel("precipitationProbability")).toBe("降水確率");
    expect(factorLabel("uvIndex")).toBe("UV指数");
    expect(factorLabel("airQuality")).toBe("大気質");
  });
});

describe("confidenceLabel", () => {
  test("labels high, medium, and low confidence", () => {
    expect(confidenceLabel("high")).toBe("信頼度 高");
    expect(confidenceLabel("medium")).toBe("信頼度 中");
    expect(confidenceLabel("low")).toBe("信頼度 低");
  });
});

describe("formatFreshness", () => {
  test("shows the instant in Japan Standard Time whatever the offset", () => {
    expect(formatFreshness("2026-11-20T02:30:00.000Z")).toBe(
      "2026/11/20 11:30",
    );
    expect(formatFreshness("2026-11-19T20:05:00-05:00")).toBe(
      "2026/11/20 10:05",
    );
  });
});

describe("formatTarget", () => {
  test("shows a moment as the date and the hour", () => {
    expect(formatTarget({ type: "moment", date: "2026-11-21", hour: 7 })).toBe(
      "11月21日(土) 7時",
    );
  });

  test("shows a day as the date with its weekday", () => {
    expect(formatTarget({ type: "day", date: "2026-11-22" })).toBe(
      "11月22日(日)",
    );
  });
});

describe("ratingClasses", () => {
  test("gives each rating colour its own badge and bar classes", () => {
    const colors = ["green", "lime", "yellow", "orange", "red"] as const;
    const badges = colors.map((c) => ratingClasses(c).badge);
    const bars = colors.map((c) => ratingClasses(c).bar);

    expect(new Set(badges).size).toBe(5);
    expect(new Set(bars).size).toBe(5);
    expect(ratingClasses("green").bar).toContain("green");
    expect(ratingClasses("red").bar).toContain("red");
  });
});
