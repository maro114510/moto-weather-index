import type { ReactNode } from "react";
import type { Remote as RemoteState } from "../useRemote";

export function RemoteView<T>(_props: {
  state: RemoteState<T> & { reload: () => void };
  children: (data: T) => ReactNode;
}) {
  return null;
}
