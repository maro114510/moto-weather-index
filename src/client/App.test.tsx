import {
  afterEach,
  beforeEach,
  describe,
  expect,
  setSystemTime,
  test,
} from "bun:test";
import { screen, within } from "@testing-library/react";
import { completeIndex } from "./testing/fixtures";
import { installFakeApi, json } from "./testing/network";
import { renderApp } from "./testing/render";

const fake = installFakeApi();

beforeEach(() => {
  setSystemTime(new Date("2026-11-20T02:30:00Z"));
  fake.answer(() => json(completeIndex()));
});
afterEach(() => setSystemTime());

describe("the application routes", () => {
  for (const [path, heading] of [
    ["/search", "地域・日付指定"],
    ["/calendar", "週間カレンダー"],
    ["/details/2026-11-21", "指数の内訳"],
    ["/settings", "現在地の設定"],
    ["/privacy", "プライバシーポリシー"],
    ["/terms", "利用規約"],
  ] as const) {
    test(`serves ${path} with its heading`, async () => {
      renderApp(path);

      expect(
        await screen.findByRole("heading", { level: 1, name: heading }),
      ).toBeTruthy();
    });
  }

  test("serves the home screen at the root", async () => {
    renderApp("/");

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "ツーリング日和指数",
      }),
    ).toBeTruthy();
  });

  test("tells the rider an unknown path does not exist and links home", () => {
    renderApp("/no-such-page");

    expect(
      screen.getByRole("heading", { name: "ページが見つかりません" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "ホームへ戻る" }).getAttribute("href"),
    ).toBe("/");
  });
});

describe("the layout around every screen", () => {
  test("links the four main screens in the navigation", async () => {
    renderApp("/settings");

    const nav = screen.getByRole("navigation", { name: "メイン" });
    const links = within(nav)
      .getAllByRole("link")
      .map((a) => [a.textContent, a.getAttribute("href")]);
    expect(links).toEqual([
      ["ホーム", "/"],
      ["地域検索", "/search"],
      ["カレンダー", "/calendar"],
      ["設定", "/settings"],
    ]);
  });

  test("links the terms and privacy pages and credits Open-Meteo in the footer", () => {
    renderApp("/settings");

    const footer = screen.getByRole("contentinfo");
    expect(
      within(footer)
        .getByRole("link", { name: "利用規約" })
        .getAttribute("href"),
    ).toBe("/terms");
    expect(
      within(footer)
        .getByRole("link", { name: "プライバシーポリシー" })
        .getAttribute("href"),
    ).toBe("/privacy");
    expect(
      within(footer)
        .getByRole("link", { name: "Open-Meteo" })
        .getAttribute("href"),
    ).toBe("https://open-meteo.com/");
  });
});
