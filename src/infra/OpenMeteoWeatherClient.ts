import type { Observation, Place, Target } from "../domain/TouringIndex";

export const OPEN_METEO_SOURCE = "Open-Meteo";

/** The Days from today for which the product presents a Touring Index. */
export const HORIZON_DAYS = 7;

export type MomentTarget = Extract<Target, { type: "moment" }>;

export interface WeatherReading {
  observation: Observation;
  source: string;
  /** The time at which the weather source returned the observation. */
  fetchedAt: string;
}

export interface DailyWeatherReading {
  days: { date: string; observation: Observation }[];
  source: string;
  fetchedAt: string;
}

export interface OpenMeteoWeatherClientOptions {
  fetch?: typeof fetch;
  now?: () => Date;
  requestTimeoutMs?: number;
}

export class OpenMeteoWeatherClient {
  constructor(_options: OpenMeteoWeatherClientOptions = {}) {}

  async getObservation(
    _place: Pick<Place, "latitude" | "longitude">,
    _moment: MomentTarget,
  ): Promise<WeatherReading> {
    return { observation: {}, source: "", fetchedAt: "" };
  }

  async getDailyObservations(
    _place: Pick<Place, "latitude" | "longitude">,
    _startDate: string,
  ): Promise<DailyWeatherReading> {
    return { days: [], source: "", fetchedAt: "" };
  }
}
