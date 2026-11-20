import { z } from "zod";
import {
  type Place,
  PlaceSchema,
  type TouringIndex,
  TouringIndexSchema,
} from "../domain/TouringIndex";

export type PlaceCandidate = Place & { region?: string };

const PlaceCandidateSchema = PlaceSchema.extend({
  region: z.string().optional(),
});

const HorizonSchema = z.object({ days: z.array(TouringIndexSchema) });
const PlacesSchema = z.object({ places: z.array(PlaceCandidateSchema) });

/** Every failure of the internal API, with the HTTP status or 0 when none arrived. */
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

async function request<S extends z.ZodType>(
  path: string,
  params: Record<string, string | undefined>,
  schema: S,
  signal?: AbortSignal,
): Promise<z.infer<S>> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, value);
  }

  let response: Response;
  try {
    response = await fetch(`${path}?${query}`, { signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ApiError("通信に失敗しました", 0);
  }

  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "error" in body
        ? String(body.error)
        : "予期しないエラーが発生しました";
    throw new ApiError(message, response.status);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError("サーバーの応答を読み取れませんでした", response.status);
  }
  return parsed.data;
}

function placeParams(place: Place) {
  return {
    lat: String(place.latitude),
    lon: String(place.longitude),
    name: place.name,
  };
}

export function getIndex(
  place: Place,
  moment?: MomentQuery,
  signal?: AbortSignal,
): Promise<TouringIndex> {
  return request(
    "/api/index",
    {
      ...placeParams(place),
      date: moment?.date,
      hour: moment === undefined ? undefined : String(moment.hour),
    },
    TouringIndexSchema,
    signal,
  );
}

export async function getHorizon(
  place: Place,
  signal?: AbortSignal,
): Promise<TouringIndex[]> {
  const { days } = await request(
    "/api/horizon",
    placeParams(place),
    HorizonSchema,
    signal,
  );
  return days;
}

export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<PlaceCandidate[]> {
  const { places } = await request(
    "/api/places",
    { q: query },
    PlacesSchema,
    signal,
  );
  return places;
}
