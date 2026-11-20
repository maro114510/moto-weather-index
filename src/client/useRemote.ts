import { useCallback, useEffect, useState } from "react";

export type Remote<T> =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "ready"; data: T };

/**
 * Loads on mount, again when `key` changes, and again on `reload`.
 * `load` is not a dependency because callers pass a fresh closure each render;
 * `key` names what it loads.
 */
export function useRemote<T>(
  load: (signal: AbortSignal) => Promise<T>,
  key: string,
): Remote<T> & { reload: () => void } {
  const [state, setState] = useState<Remote<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: key names what load loads
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ status: "ready", data });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          error: error instanceof Error ? error : new Error(String(error)),
        });
      },
    );
    return () => controller.abort();
  }, [key, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}
