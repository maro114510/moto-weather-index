import {
  afterEach,
  beforeEach,
  describe,
  expect,
  setSystemTime,
  test,
} from "bun:test";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { completeIndex, incompleteIndex } from "../testing/fixtures";
import { installFakeApi, json } from "../testing/network";
import { renderApp } from "../testing/render";

const fake = installFakeApi();
const user = userEvent.setup({ delay: null });

beforeEach(() => {
  setSystemTime(new Date("2026-11-20T02:30:00Z"));
  fake.answer(() => json(completeIndex()));
});
afterEach(() => setSystemTime());

describe("the details screen", () => {
  test("asks for midday of a future date and presents the index completely", async () => {
    renderApp("/details/2026-11-22");

    expect(
      await screen.findByRole("list", { name: "要素別の点数" }),
    ).toBeTruthy();
    const url = fake.requests[0];
    expect(url.searchParams.get("date")).toBe("2026-11-22");
    expect(url.searchParams.get("hour")).toBe("12");
  });

  test("asks for the current hour when the date is today", async () => {
    renderApp("/details/2026-11-20");
    await screen.findByRole("list", { name: "要素別の点数" });

    expect(fake.requests[0].searchParams.get("hour")).toBe("11");
  });

  test("loads the index again for the hour the rider picks", async () => {
    renderApp("/details/2026-11-22");
    await screen.findByRole("list", { name: "要素別の点数" });

    await user.selectOptions(screen.getByLabelText("時刻"), "7");

    await screen.findByRole("list", { name: "要素別の点数" });
    expect(fake.requests.at(-1)?.searchParams.get("hour")).toBe("7");
  });

  test("offers all 24 hours", async () => {
    renderApp("/details/2026-11-22");
    await screen.findByRole("list", { name: "要素別の点数" });

    const options = screen.getByLabelText("時刻").querySelectorAll("option");

    expect(options).toHaveLength(24);
  });

  test("names the missing factors and the lower confidence", async () => {
    fake.answer(() => json(incompleteIndex()));
    renderApp("/details/2026-11-22");

    const missing = await screen.findByRole("list", {
      name: "取得できなかった要素",
    });
    expect(missing.textContent).toContain("UV指数");
    expect(screen.getByText("信頼度 中")).toBeTruthy();
  });

  for (const [what, path] of [
    ["not a date", "/details/tomorrow"],
    ["a past date", "/details/2026-11-19"],
    ["a date beyond the forecast", "/details/2026-12-06"],
  ] as const) {
    test(`explains ${what} and asks nothing of the server`, () => {
      renderApp(path);

      expect(screen.getByRole("alert").textContent).toContain(
        "表示できる日付は今日から15日後までです",
      );
      expect(
        screen
          .getByRole("link", { name: "今日の内訳を見る" })
          .getAttribute("href"),
      ).toBe("/details/2026-11-20");
      expect(fake.requests).toHaveLength(0);
    });
  }

  test("accepts the last day of the forecast", async () => {
    renderApp("/details/2026-12-05");

    expect(
      await screen.findByRole("list", { name: "要素別の点数" }),
    ).toBeTruthy();
  });
});
