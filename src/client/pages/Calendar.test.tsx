import {
  afterEach,
  beforeEach,
  describe,
  expect,
  setSystemTime,
  test,
} from "bun:test";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { addDays } from "../clock";
import { completeIndex, incompleteIndex, weekOf } from "../testing/fixtures";
import { installFakeApi, json } from "../testing/network";
import { renderApp } from "../testing/render";

const TODAY = "2026-11-20";
const DATES = Array.from({ length: 7 }, (_, i) => addDays(TODAY, i));
const fake = installFakeApi();
const user = userEvent.setup({ delay: null });

function answerWith(days: ReturnType<typeof weekOf>) {
  fake.answer(() => json({ place: completeIndex().place, days }));
}

beforeEach(() => {
  setSystemTime(new Date("2026-11-20T02:30:00Z"));
  answerWith(
    weekOf(DATES, (_, i) => ({
      score: 100 - i * 10,
      rating:
        i < 2
          ? { label: "最高", color: "green" }
          : { label: "良好", color: "lime" },
    })),
  );
});
afterEach(() => setSystemTime());

describe("the calendar screen", () => {
  test("asks for the week of the chosen place", async () => {
    renderApp("/calendar");
    await screen.findByRole("list", { name: "1週間の指数" });

    expect(fake.requests[0].pathname).toBe("/api/horizon");
    expect(fake.requests[0].searchParams.get("lat")).toBe("35.6812");
  });

  test("presents seven days from today with the score and rating of each", async () => {
    renderApp("/calendar");

    const week = await screen.findByRole("list", { name: "1週間の指数" });
    const days = within(week).getAllByRole("button");
    expect(days).toHaveLength(7);
    expect(days[0].textContent).toContain("11月20日(金)");
    expect(days[0].textContent).toContain("今日");
    expect(days[0].textContent).toContain("100");
    expect(days[0].textContent).toContain("最高");
    expect(days[6].textContent).toContain("11月26日(木)");
    expect(days[6].textContent).toContain("40");
    expect(days[6].textContent).toContain("良好");
  });

  test("marks a day whose index lacks factors, so it is not read as comparable", async () => {
    answerWith(
      weekOf(DATES, (date) =>
        date === "2026-11-22"
          ? {
              ...incompleteIndex({ target: { type: "day", date } }),
            }
          : {},
      ),
    );
    renderApp("/calendar");

    const week = await screen.findByRole("list", { name: "1週間の指数" });
    const days = within(week).getAllByRole("button");
    expect(days[2].textContent).toContain("信頼度 中");
    expect(days[2].textContent).toContain("要素不足");
    expect(days[1].textContent).not.toContain("要素不足");
  });

  test("shows the complete index of the first day, then of the day the rider selects", async () => {
    renderApp("/calendar");
    const detail = await screen.findByRole("region", {
      name: "選択した日の指数",
    });
    expect(within(detail).getByText("11月20日(金)")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /11月23日\(月\)/ }));

    const next = screen.getByRole("region", { name: "選択した日の指数" });
    expect(within(next).getByText("11月23日(月)")).toBeTruthy();
    expect(
      within(next).getByRole("list", { name: "要素別の点数" }),
    ).toBeTruthy();
  });

  test("names the missing factors of the selected day", async () => {
    answerWith(
      weekOf(DATES, (date) =>
        date === "2026-11-22"
          ? incompleteIndex({ target: { type: "day", date } })
          : {},
      ),
    );
    renderApp("/calendar");
    await screen.findByRole("list", { name: "1週間の指数" });

    await user.click(screen.getByRole("button", { name: /11月22日\(日\)/ }));

    const missing = screen.getByRole("list", { name: "取得できなかった要素" });
    expect(missing.textContent).toContain("大気質");
  });

  test("links the selected day to its details", async () => {
    renderApp("/calendar");
    await screen.findByRole("list", { name: "1週間の指数" });
    await user.click(screen.getByRole("button", { name: /11月24日\(火\)/ }));

    const link = screen.getByRole("link", { name: "この日の内訳を見る" });

    expect(link.getAttribute("href")).toBe("/details/2026-11-24");
  });

  test("shows the failure and loads the week again on retry", async () => {
    fake.answer(() => json({ error: "External service unavailable" }, 503));
    renderApp("/calendar");
    expect((await screen.findByRole("alert")).textContent).toContain(
      "External service unavailable",
    );

    answerWith(weekOf(DATES));
    await user.click(screen.getByRole("button", { name: "再読み込み" }));

    expect(
      await screen.findByRole("list", { name: "1週間の指数" }),
    ).toBeTruthy();
  });
});
