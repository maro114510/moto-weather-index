import { describe, expect, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import type { TouringIndex } from "../../domain/TouringIndex";
import { completeIndex, incompleteIndex } from "../testing/fixtures";
import { IndexView } from "./IndexView";

function show(index: TouringIndex) {
  render(<IndexView index={index} />);
}

describe("IndexView for a complete index", () => {
  test("presents the place, the target, the score, and the rating", () => {
    show(completeIndex());

    expect(screen.getByRole("heading", { name: "渋谷" })).toBeTruthy();
    expect(screen.getByText("11月21日(土) 10時")).toBeTruthy();
    expect(screen.getByLabelText("ツーリング指数").textContent).toBe("100");
    expect(screen.getByText("最高")).toBeTruthy();
  });

  test("lists all eight factors with their points out of their maximum", () => {
    show(completeIndex());

    const list = screen.getByRole("list", { name: "要素別の点数" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(8);
    expect(within(list).getByText("天気").closest("li")?.textContent).toContain(
      "30 / 30",
    );
    expect(
      within(list).getByText("UV指数").closest("li")?.textContent,
    ).toContain("5 / 5");
  });

  test("shows high confidence, the source with its attribution, and the freshness", () => {
    show(completeIndex());

    expect(screen.getByText("信頼度 高")).toBeTruthy();
    const source = screen.getByRole("link", { name: "Open-Meteo" });
    expect(source.getAttribute("href")).toBe("https://open-meteo.com/");
    expect(screen.getByText(/2026\/11\/20 11:30/)).toBeTruthy();
  });

  test("names no missing factor and raises no incompleteness notice", () => {
    show(completeIndex());

    expect(screen.queryByText(/取得できなかった/)).toBeNull();
    expect(
      screen.queryByRole("list", { name: "取得できなかった要素" }),
    ).toBeNull();
  });
});

describe("IndexView for an incomplete index", () => {
  test("names every missing factor in its own list", () => {
    show(incompleteIndex());

    const missing = screen.getByRole("list", { name: "取得できなかった要素" });
    const names = within(missing)
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(names).toEqual(["UV指数", "大気質"]);
  });

  test("states that the index uses the present factors and shows lower confidence", () => {
    show(incompleteIndex());

    expect(screen.getByRole("note").textContent).toContain(
      "取得できた要素だけで算出しています",
    );
    expect(screen.getByText("信頼度 中")).toBeTruthy();
    expect(screen.queryByText("信頼度 高")).toBeNull();
  });

  test("lists only the present factors in the points list", () => {
    show(incompleteIndex());

    const list = screen.getByRole("list", { name: "要素別の点数" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(6);
    expect(within(list).queryByText("UV指数")).toBeNull();
  });
});

describe("IndexView for a low-confidence index", () => {
  test("labels the confidence as low", () => {
    show(
      incompleteIndex({
        confidence: "low",
        factors: completeIndex().factors.slice(0, 2),
        missingFactors: [
          "wind",
          "humidity",
          "visibility",
          "precipitationProbability",
          "uvIndex",
          "airQuality",
        ],
      }),
    );

    expect(screen.getByText("信頼度 低")).toBeTruthy();
    expect(
      screen.getByRole("list", { name: "取得できなかった要素" }).children,
    ).toHaveLength(6);
  });
});
