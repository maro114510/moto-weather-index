import type { Place, TouringIndex } from "../domain/TouringIndex";

export type PlaceCandidate = Place & { region?: string };

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface MomentQuery {
  date: string;
  hour: number;
}

export async function getIndex(
  _place: Place,
  _moment?: MomentQuery,
  _signal?: AbortSignal,
): Promise<TouringIndex> {
  return undefined as never;
}

export async function getHorizon(
  _place: Place,
  _signal?: AbortSignal,
): Promise<TouringIndex[]> {
  return [];
}

export async function searchPlaces(
  _query: string,
  _signal?: AbortSignal,
): Promise<PlaceCandidate[]> {
  return [];
}
