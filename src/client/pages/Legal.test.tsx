import { describe, expect, test } from "bun:test";
import { screen } from "@testing-library/react";
import { renderApp } from "../testing/render";

describe("the privacy policy", () => {
  test("states that the position is sent to this service and the forecast provider, stored on the device for 24 hours, and never kept by the service", () => {
    renderApp("/privacy");

    const text = document.body.textContent ?? "";
    expect(text).toContain("Open-Meteo");
    expect(text).toContain("最大24時間");
    expect(text).toContain("サーバーに保存しません");
  });

  test("gives a contact address", () => {
    renderApp("/privacy");

    expect(screen.getByText(/atsuki\.nohira@stelzen\.dev/)).toBeTruthy();
  });
});

describe("the terms of use", () => {
  test("holds the disclaimer that the index is a reference, not a guarantee", () => {
    renderApp("/terms");

    expect(
      screen.getByText(/正確性・完全性を保証するものではありません/),
    ).toBeTruthy();
  });
});
