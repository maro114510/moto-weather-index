import type { Place } from "../domain/TouringIndex";

/** A place the rider can choose, with the region that tells namesakes apart. */
export type PlaceCandidate = Place & { region?: string };

export interface OpenMeteoGeocodingClientOptions {
  fetch?: typeof fetch;
  requestTimeoutMs?: number;
}

export class OpenMeteoGeocodingClient {
  constructor(_options: OpenMeteoGeocodingClientOptions = {}) {}

  async search(_query: string): Promise<PlaceCandidate[]> {
    return [];
  }
}
