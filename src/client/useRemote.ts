export type Remote<T> =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "ready"; data: T };

export function useRemote<T>(
  _load: (signal: AbortSignal) => Promise<T>,
  _key: string,
): Remote<T> & { reload: () => void } {
  return { status: "loading", reload: () => {} };
}
