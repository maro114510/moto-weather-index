import {
  afterEach,
  beforeEach,
  describe,
  expect,
  setSystemTime,
  test,
} from "bun:test";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { completeIndex, incompleteIndex } from "../testing/fixtures";
import { stubGeolocation } from "../testing/geolocation";
import { installFakeApi, json } from "../testing/network";
import { renderApp } from "../testing/render";

const fake = installFakeApi();
const user = userEvent.setup({ delay: null });

beforeEach(() => {
  setSystemTime(new Date("2026-11-20T02:30:00Z"));
  fake.answer(() => json(completeIndex()));
});
afterEach(() => setSystemTime());

describe("the home screen", () => {
  test("shows the index for Tokyo now when no place was ever chosen", async () => {
    renderApp("/");

    expect(await screen.findByLabelText("ツーリング指数")).toBeTruthy();
    const url = fake.requests[0];
    expect(url.pathname).toBe("/api/index");
    expect(url.searchParams.get("lat")).toBe("35.6812");
    expect(url.searchParams.get("lon")).toBe("139.7671");
    expect(url.searchParams.has("date")).toBe(false);
  });

  test("shows loading before the index arrives", () => {
    renderApp("/");

    expect(screen.getByRole("status").textContent).toContain("読み込み中");
  });

  test("names the factors the source did not return and the lower confidence", async () => {
    fake.answer(() => json(incompleteIndex()));
    renderApp("/");

    const missing = await screen.findByRole("list", {
      name: "取得できなかった要素",
    });
    expect(missing.textContent).toContain("UV指数");
    expect(missing.textContent).toContain("大気質");
    expect(screen.getByText("信頼度 中")).toBeTruthy();
  });

  test("shows the server's message and loads again on retry after a failure", async () => {
    fake.answer(() => json({ error: "Weather data is unavailable" }, 404));
    renderApp("/");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Weather data is unavailable");

    fake.answer(() => json(completeIndex()));
    await user.click(screen.getByRole("button", { name: "再読み込み" }));

    expect(await screen.findByLabelText("ツーリング指数")).toBeTruthy();
  });

  test("links to the search, the week, and today's details", async () => {
    renderApp("/");
    await screen.findByLabelText("ツーリング指数");

    const hrefs = (name: string) =>
      screen.getAllByRole("link", { name }).map((a) => a.getAttribute("href"));
    expect(hrefs("指定して見る")).toEqual(["/search"]);
    expect(hrefs("週間をチェック")).toEqual(["/calendar"]);
    expect(hrefs("内訳を見る")).toEqual(["/details/2026-11-20"]);
  });
});

describe("the current-location consent on the home screen", () => {
  test("offers the choice while consent is unset and shows the index for the position once granted", async () => {
    stubGeolocation({ latitude: 34.6937, longitude: 135.5023 });
    renderApp("/");
    await screen.findByLabelText("ツーリング指数");

    await user.click(
      screen.getByRole("button", { name: "同意して現在地を利用" }),
    );

    await waitFor(() =>
      expect(fake.requests.at(-1)?.searchParams.get("lat")).toBe("34.6937"),
    );
    expect(fake.requests.at(-1)?.searchParams.get("name")).toBe("現在地");
  });

  test("offers no choice once the rider declined", async () => {
    renderApp("/");
    await screen.findByLabelText("ツーリング指数");

    await user.click(screen.getByRole("button", { name: "同意しない" }));

    expect(
      screen.queryByRole("button", { name: "同意して現在地を利用" }),
    ).toBeNull();
  });
});
