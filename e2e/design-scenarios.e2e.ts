import { expect, type Page, test } from "@playwright/test";

/**
 * The browser runs the built application served the way production serves it.
 * The weather source is the only thing replaced: the API answers are fixed so
 * the run never depends on Open-Meteo.
 */

const FACTORS = [
  ["weather", 30],
  ["temperature", 20],
  ["wind", 15],
  ["humidity", 10],
  ["visibility", 5],
  ["precipitationProbability", 10],
  ["uvIndex", 5],
  ["airQuality", 5],
] as const;

const place = { name: "東京", latitude: 35.6812, longitude: 139.7671 };

function index(overrides: Record<string, unknown> = {}) {
  return {
    place,
    target: { type: "moment", date: "2026-11-21", hour: 10 },
    score: 100,
    rating: { label: "最高", color: "green" },
    factors: FACTORS.map(([key, max]) => ({ key, points: max, max })),
    missingFactors: [],
    confidence: "high",
    source: "Open-Meteo",
    freshness: "2026-11-20T02:30:00.000Z",
    ...overrides,
  };
}

async function stubApi(page: Page, handlers: Record<string, () => unknown>) {
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const handler = handlers[path];
    return handler
      ? route.fulfill({ json: handler() })
      : route.fulfill({ status: 404, json: { error: "not stubbed" } });
  });
}

test("a rider decides whether to ride now: complete coverage", async ({
  page,
}) => {
  await stubApi(page, { "/api/index": () => index() });

  await page.goto("/");

  await expect(page.getByLabel("ツーリング指数")).toHaveText("100");
  await expect(page.getByText("最高", { exact: true })).toBeVisible();
  await expect(page.getByText("信頼度 高")).toBeVisible();
  await expect(
    page.getByRole("list", { name: "要素別の点数" }).getByRole("listitem"),
  ).toHaveCount(8);
  await expect(page.getByText("取得時刻 2026/11/20 11:30")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open-Meteo" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "取得できなかった要素" }),
  ).toHaveCount(0);
});

test("a rider decides whether to ride now: incomplete coverage", async ({
  page,
}) => {
  await stubApi(page, {
    "/api/index": () =>
      index({
        score: 71,
        rating: { label: "良好", color: "lime" },
        factors: FACTORS.filter(
          ([key]) => key !== "airQuality" && key !== "uvIndex",
        ).map(([key, max]) => ({ key, points: Math.round(max * 0.7), max })),
        missingFactors: ["uvIndex", "airQuality"],
        confidence: "medium",
      }),
  });

  await page.goto("/");

  await expect(page.getByLabel("ツーリング指数")).toHaveText("71");
  const missing = page.getByRole("list", { name: "取得できなかった要素" });
  await expect(missing.getByRole("listitem")).toHaveText(["UV指数", "大気質"]);
  await expect(page.getByText("信頼度 中")).toBeVisible();
  await expect(page.getByRole("note")).toContainText(
    "取得できた要素だけで算出しています",
  );
});

test("a rider plans the coming week", async ({ page }) => {
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 10, 20 + i));
    return d.toISOString().slice(0, 10);
  });
  await stubApi(page, {
    "/api/horizon": () => ({
      place,
      days: dates.map((date, i) =>
        index({
          target: { type: "day", date },
          score: 90 - i * 10,
          rating:
            i === 0
              ? { label: "最高", color: "green" }
              : { label: "良好", color: "lime" },
        }),
      ),
    }),
  });

  await page.goto("/calendar");

  const week = page.getByRole("list", { name: "1週間の指数" });
  await expect(week.getByRole("button")).toHaveCount(7);
  await expect(week.getByRole("button").first()).toContainText("90");
  await expect(week.getByRole("button").last()).toContainText("30");

  await week.getByRole("button").nth(3).click();
  const selected = page.getByRole("region", { name: "選択した日の指数" });
  await expect(selected.getByLabel("ツーリング指数")).toHaveText("60");
  await expect(
    selected.getByRole("link", { name: "この日の内訳を見る" }),
  ).toHaveAttribute("href", `/details/${dates[3]}`);
});

test("a client route opens directly and an unknown one says so", async ({
  page,
}) => {
  await page.goto("/privacy");
  await expect(
    page.getByRole("heading", { level: 1, name: "プライバシーポリシー" }),
  ).toBeVisible();

  await page.goto("/no-such-page");
  await expect(
    page.getByRole("heading", { name: "ページが見つかりません" }),
  ).toBeVisible();
});
