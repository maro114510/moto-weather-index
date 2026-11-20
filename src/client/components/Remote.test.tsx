import { describe, expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Remote } from "../useRemote";
import { RemoteView } from "./Remote";

function show(state: Remote<string>, reload = () => {}) {
  render(
    <RemoteView state={{ ...state, reload }}>
      {(data) => <p>{`data: ${data}`}</p>}
    </RemoteView>,
  );
}

describe("RemoteView", () => {
  test("announces loading and renders no data", () => {
    show({ status: "loading" });

    expect(screen.getByRole("status").textContent).toContain("読み込み中");
    expect(screen.queryByText(/data:/)).toBeNull();
  });

  test("renders the data once ready", () => {
    show({ status: "ready", data: "x" });

    expect(screen.getByText("data: x")).toBeTruthy();
  });

  test("shows the error as an alert with a retry that reloads", async () => {
    const reload = mock(() => {});
    show({ status: "error", error: new Error("通信に失敗しました") }, reload);

    expect(screen.getByRole("alert").textContent).toContain(
      "通信に失敗しました",
    );
    await userEvent.click(screen.getByRole("button", { name: "再読み込み" }));

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
