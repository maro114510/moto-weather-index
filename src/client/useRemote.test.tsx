import { describe, expect, test } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useRemote } from "./useRemote";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useRemote", () => {
  test("is loading first and ready with the data once the load resolves", async () => {
    const load = deferred<string>();
    const { result } = renderHook(() => useRemote(() => load.promise, "a"));

    expect(result.current.status).toBe("loading");
    await act(async () => load.resolve("data"));

    expect(result.current).toMatchObject({ status: "ready", data: "data" });
  });

  test("reports the error when the load rejects", async () => {
    const { result } = renderHook(() =>
      useRemote(() => Promise.reject(new Error("boom")), "a"),
    );

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current).toMatchObject({ error: { message: "boom" } });
  });

  test("loads again after reload and shows loading meanwhile", async () => {
    let calls = 0;
    const { result } = renderHook(() =>
      useRemote(async () => `call ${++calls}`, "a"),
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.reload());

    expect(result.current.status).toBe("loading");
    await waitFor(() =>
      expect(result.current).toMatchObject({ data: "call 2" }),
    );
  });

  test("loads again when the key changes and aborts the earlier load", async () => {
    const signals: AbortSignal[] = [];
    const first = deferred<string>();
    const { result, rerender } = renderHook(
      ({ key }) =>
        useRemote((signal) => {
          signals.push(signal);
          return key === "a" ? first.promise : Promise.resolve("for b");
        }, key),
      { initialProps: { key: "a" } },
    );

    rerender({ key: "b" });

    await waitFor(() =>
      expect(result.current).toMatchObject({ data: "for b" }),
    );
    expect(signals[0].aborted).toBe(true);
  });

  test("ignores an answer that arrives after the key changed", async () => {
    const first = deferred<string>();
    const { result, rerender } = renderHook(
      ({ key }) =>
        useRemote(
          () => (key === "a" ? first.promise : Promise.resolve("for b")),
          key,
        ),
      { initialProps: { key: "a" } },
    );
    rerender({ key: "b" });
    await waitFor(() =>
      expect(result.current).toMatchObject({ data: "for b" }),
    );

    await act(async () => first.resolve("late for a"));

    expect(result.current).toMatchObject({ data: "for b" });
  });
});
