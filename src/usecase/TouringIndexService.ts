import type {
  Observation,
  Place,
  Target,
  TouringIndex,
} from "../domain/TouringIndex";

export interface WeatherReading {
  observation: Observation;
  source: string;
  fetchedAt: string;
}

export interface DailyWeatherReading {
  days: { date: string; observation: Observation }[];
  source: string;
  fetchedAt: string;
}

export interface WeatherSource {
  getObservation(
    place: Pick<Place, "latitude" | "longitude">,
    moment: Extract<Target, { type: "moment" }>,
  ): Promise<WeatherReading>;
  getDailyObservations(
    place: Pick<Place, "latitude" | "longitude">,
  ): Promise<DailyWeatherReading>;
}

/** Holds a reading for a short time under a key the service chooses. */
export interface ReadingCache {
  get(key: string): Promise<unknown | undefined>;
  put(key: string, value: unknown): Promise<void>;
}

export class TouringIndexService {
  constructor(
    _source: WeatherSource,
    _cache: ReadingCache,
    _now: () => Date = () => new Date(),
  ) {}

  async indexAt(
    _place: Place,
    _moment: Extract<Target, { type: "moment" }>,
  ): Promise<TouringIndex> {
    throw new Error("not implemented");
  }

  async horizon(_place: Place): Promise<TouringIndex[]> {
    throw new Error("not implemented");
  }
}
