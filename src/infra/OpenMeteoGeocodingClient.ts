import { z } from "zod";
import { type Place, PlaceSchema } from "../domain/TouringIndex";
import { fetchJson, invalidResponse, parseResponse } from "./openMeteoHttp";

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const MAX_CANDIDATES = 10;

/** A place the rider can choose, with the region that tells namesakes apart. */
export type PlaceCandidate = Place & { region?: string };

export interface OpenMeteoGeocodingClientOptions {
  fetch?: typeof fetch;
  requestTimeoutMs?: number;
}

/** Open-Meteo omits `results` when nothing matches. */
const GeocodingSchema = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        admin1: z.string().optional(),
        admin2: z.string().optional(),
      }),
    )
    .optional(),
});

export class OpenMeteoGeocodingClient {
  private readonly fetchImpl: typeof fetch;
  private readonly requestTimeoutMs: number;

  constructor(options: OpenMeteoGeocodingClientOptions = {}) {
    this.fetchImpl = options.fetch ?? fetch;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 10_000;
  }

  async search(query: string): Promise<PlaceCandidate[]> {
    const body = await fetchJson(
      this.fetchImpl,
      this.requestTimeoutMs,
      GEOCODING_URL,
      {
        name: query,
        count: String(MAX_CANDIDATES),
        language: "ja",
        countryCode: "JP",
        format: "json",
      },
    );
    const { results = [] } = parseResponse(GeocodingSchema, body);

    return results.map((r, i) => {
      const place = PlaceSchema.safeParse({
        name: r.name,
        latitude: r.latitude,
        longitude: r.longitude,
      });
      if (!place.success) {
        throw invalidResponse(`results.${i}`, place.error.issues[0]?.message);
      }
      const region = [r.admin1, r.admin2].filter(Boolean).join(" ");
      return region === "" ? place.data : { ...place.data, region };
    });
  }
}
