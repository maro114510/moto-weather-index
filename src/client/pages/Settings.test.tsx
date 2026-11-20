import { describe, expect, test } from "bun:test";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { stubGeolocation } from "../testing/geolocation";
import { renderApp } from "../testing/render";

const user = userEvent.setup({ delay: null });
const button = (name: string) => screen.queryByRole("button", { name });

describe("the settings screen", () => {
  test("offers consent or refusal while consent is unset", () => {
    renderApp("/settings");

    expect(screen.getByRole("heading", { name: "現在地の設定" })).toBeTruthy();
    expect(button("同意して現在地を利用")).toBeTruthy();
    expect(button("同意しない")).toBeTruthy();
    expect(button("保存した現在地を削除")).toBeNull();
  });

  test("states what is sent and for how long it is kept", () => {
    renderApp("/settings");

    expect(screen.getByText(/最大24時間/)).toBeTruthy();
  });

  test("offers update, delete, and withdraw after consent is granted", async () => {
    stubGeolocation({ latitude: 34.6937, longitude: 135.5023 });
    renderApp("/settings");

    await user.click(button("同意して現在地を利用") as HTMLElement);

    expect(
      await screen.findByRole("button", { name: "現在地を更新" }),
    ).toBeTruthy();
    expect(button("保存した現在地を削除")).toBeTruthy();
    expect(button("同意を撤回")).toBeTruthy();
    expect(button("同意して現在地を利用")).toBeNull();
  });

  test("states that the current location is off once the rider declined", async () => {
    renderApp("/settings");

    await user.click(button("同意しない") as HTMLElement);

    expect(screen.getByText(/現在地を使用しない設定です/)).toBeTruthy();
    expect(button("同意して現在地を利用")).toBeTruthy();
  });

  test("returns to the first choice after consent is withdrawn", async () => {
    stubGeolocation({ latitude: 34.6937, longitude: 135.5023 });
    renderApp("/settings");
    await user.click(button("同意して現在地を利用") as HTMLElement);
    await user.click(await screen.findByRole("button", { name: "同意を撤回" }));

    expect(button("同意しない")).toBeTruthy();
    expect(button("現在地を更新")).toBeNull();
  });

  test("shows why the location could not be used and keeps the choice available", async () => {
    stubGeolocation({ code: 1 });
    renderApp("/settings");

    await user.click(button("同意して現在地を利用") as HTMLElement);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("許可されませんでした");
    expect(button("同意して現在地を利用")).toBeTruthy();
  });
});
