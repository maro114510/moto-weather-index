import type { ReactNode } from "react";
import type { Remote } from "../useRemote";

export function RemoteView<T>({
  state,
  children,
}: {
  state: Remote<T> & { reload: () => void };
  children: (data: T) => ReactNode;
}) {
  if (state.status === "loading") {
    return (
      <p
        role="status"
        className="rounded-xl bg-white/70 p-6 text-center text-slate-500"
      >
        読み込み中…
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <div
        role="alert"
        className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-6 text-red-800"
      >
        <p>{state.error.message}</p>
        <button
          type="button"
          onClick={state.reload}
          className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
        >
          再読み込み
        </button>
      </div>
    );
  }
  return <>{children(state.data)}</>;
}
