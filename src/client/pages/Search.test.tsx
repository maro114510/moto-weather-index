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
import { completeIndex } from "../testing/fixtures";
import { installFakeApi, json } from "../testing/network";
import { renderApp } from "../testing/render";

const fake = installFakeApi();
const user = userEvent.setup({ delay: null });

const shibuya = {
  name: "渋谷",
  latitude: 35.6589,
  longitude: 139.70665,
  region: "東京都 渋谷区",
};
const shibuyaKyoto = {
  name: "渋谷",
  latitude: 35.0,
  longitude: 135.7,
  region: "京都府 京都市",
};

function answerSearch(places: object[]) {
  fake.answer((url) =>
    url.pathname === "/api/places"
      ? json({ places })
      : json(
          completeIndex({
            place: {
              name: "渋谷",
              latitude: Number(url.searchParams.get("lat")),
              longitude: Number(url.searchParams.get("lon")),
            },
          }),
        ),
  );
}

async function search(text: string) {
  await user.type(screen.getByRole("searchbox", { name: "地名" }), text);
  await user.click(screen.getByRole("button", { name: "検索" }));
}

beforeEach(() => {
  setSystemTime(new Date("2026-11-20T02:30:00Z"));
  answerSearch([shibuya, shibuyaKyoto]);
});
afterEach(() => setSystemTime());

describe("the search screen", () => {
  test("asks nothing of the server before a search", () => {
    renderApp("/search");

    expect(
      screen.getByRole("heading", { name: "地域・日付指定" }),
    ).toBeTruthy();
    expect(fake.requests).toHaveLength(0);
  });

  test("does not search for an empty or blank name", async () => {
    renderApp("/search");

    await user.type(screen.getByRole("searchbox", { name: "地名" }), "   ");
    await user.click(screen.getByRole("button", { name: "検索" }));

    expect(fake.requests).toHaveLength(0);
  });

  test("lists each candidate with its region so namesakes can be told apart", async () => {
    renderApp("/search");

    await search("渋谷");

    const list = await screen.findByRole("list", { name: "検索結果" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("東京都 渋谷区");
    expect(items[1].textContent).toContain("京都府 京都市");
    expect(fake.requests[0].searchParams.get("q")).toBe("渋谷");
  });

  test("says so when nothing matches", async () => {
    answerSearch([]);
    renderApp("/search");

    await search("ほげほげ");

    expect((await screen.findByRole("status")).textContent).toContain(
      "見つかりませんでした",
    );
  });

  test("shows the failure of the search", async () => {
    fake.answer(() => json({ error: "External service unavailable" }, 503));
    renderApp("/search");

    await search("渋谷");

    expect((await screen.findByRole("alert")).textContent).toContain(
      "External service unavailable",
    );
  });

  test("presents the complete index of the chosen candidate for today's hour", async () => {
    renderApp("/search");
    await search("渋谷");

    await user.click(
      await screen.findByRole("button", { name: /京都府 京都市/ }),
    );

    expect(
      await screen.findByRole("list", { name: "要素別の点数" }),
    ).toBeTruthy();
    const url = fake.requests.at(-1);
    expect(url?.pathname).toBe("/api/index");
    expect(url?.searchParams.get("lat")).toBe("35");
    expect(url?.searchParams.get("lon")).toBe("135.7");
    expect(url?.searchParams.get("date")).toBe("2026-11-20");
    expect(url?.searchParams.get("hour")).toBe("11");
  });

  test("offers the 16 days of the forecast, starting today", async () => {
    renderApp("/search");
    await search("渋谷");
    await user.click(
      await screen.findByRole("button", { name: /東京都 渋谷区/ }),
    );
    await screen.findByRole("list", { name: "要素別の点数" });

    const options = [
      ...screen.getByLabelText("日付").querySelectorAll("option"),
    ];

    expect(options).toHaveLength(16);
    expect(options[0].getAttribute("value")).toBe("2026-11-20");
    expect(options[15].getAttribute("value")).toBe("2026-12-05");
  });

  test("loads the index again for the date and hour the rider picks", async () => {
    renderApp("/search");
    await search("渋谷");
    await user.click(
      await screen.findByRole("button", { name: /東京都 渋谷区/ }),
    );
    await screen.findByRole("list", { name: "要素別の点数" });

    await user.selectOptions(screen.getByLabelText("日付"), "2026-11-23");
    await user.selectOptions(screen.getByLabelText("時刻"), "6");

    await screen.findByRole("list", { name: "要素別の点数" });
    const url = fake.requests.at(-1);
    expect(url?.searchParams.get("date")).toBe("2026-11-23");
    expect(url?.searchParams.get("hour")).toBe("6");
  });
});
