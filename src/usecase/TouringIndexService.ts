import { z } from "zod";
import { ERROR_CODES } from "../constants/errorCodes";
import { HTTP_STATUS } from "../constants/httpStatus";
import { HttpError } from "../domain/HttpError";
import {
  computeTouringIndex,
  type Observation,
  ObservationSchema,
  type Place,
  type Target,
  type TouringIndex,
} from "../domain/TouringIndex";
import { getJstDateString } from "../utils/dateUtils";
import { logger } from "../utils/logger";

type MomentTarget = Extract<Target, { type: "moment" }>;
type Coordinates = Pick<Place, "latitude" | "longitude">;

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

export interface WeatherSource {
  getObservation(
    place: Coordinates,
    moment: MomentTarget,
  ): Promise<WeatherReading>;
  getDailyObservations(place: Coordinates): Promise<DailyWeatherReading>;
}

/** Holds a reading for a short time under a key the service chooses. */
export interface ReadingCache {
  get(key: string): Promise<unknown | undefined>;
  put(key: string, value: unknown): Promise<void>;
}

const ReadingSchema = z.object({
  observation: ObservationSchema,
  source: z.string().min(1),
  fetchedAt: z.iso.datetime({ offset: true }),
});

const DailyReadingSchema = z.object({
  days: z.array(
    z.object({ date: z.iso.date(), observation: ObservationSchema }),
  ),
  source: z.string().min(1),
  fetchedAt: z.iso.datetime({ offset: true }),
});

/** Two decimals are about a kilometre, so near-identical places share one reading. */
function roundCoordinate(value: number): string {
  return value.toFixed(2);
}

function placeKey(place: Coordinates): string {
  return `${roundCoordinate(place.latitude)},${roundCoordinate(place.longitude)}`;
}

function noFactor(): HttpError {
  return new HttpError(
    HTTP_STATUS.NOT_FOUND,
    "Weather data is unavailable for the specified coordinates/date",
    { code: ERROR_CODES.WEATHER_DATA_NOT_FOUND },
  );
}

function hasFactor(observation: Observation): boolean {
  return Object.values(observation).some((v) => v !== undefined);
}

export class TouringIndexService {
  constructor(
    private readonly source: WeatherSource,
    private readonly cache: ReadingCache,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /**
   * The cache only spares the provider, so a cache that fails or holds an
   * unreadable entry is a miss, never a failed request.
   */
  private async remembered<S extends z.ZodType>(
    key: string,
    schema: S,
    fetchFresh: () => Promise<z.infer<S>>,
  ): Promise<z.infer<S>> {
    try {
      const hit = schema.safeParse(await this.cache.get(key));
      if (hit.success) return hit.data;
    } catch (error) {
      logger.warn("Reading cache lookup failed", {
        operation: "reading_cache_get",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }

    const fresh = await fetchFresh();
    try {
      await this.cache.put(key, fresh);
    } catch (error) {
      logger.warn("Reading cache store failed", {
        operation: "reading_cache_put",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
    return fresh;
  }

  async indexAt(place: Place, moment: MomentTarget): Promise<TouringIndex> {
    const reading = await this.remembered(
      `index:${placeKey(place)}:${moment.date}T${moment.hour}`,
      ReadingSchema,
      () => this.source.getObservation(place, moment),
    );
    if (!hasFactor(reading.observation)) throw noFactor();

    return computeTouringIndex({
      place,
      target: moment,
      observation: reading.observation,
      source: reading.source,
      fetchedAt: reading.fetchedAt,
    });
  }

  async horizon(place: Place): Promise<TouringIndex[]> {
    const today = getJstDateString(this.now());
    const reading = await this.remembered(
      `horizon:${placeKey(place)}:${today}`,
      DailyReadingSchema,
      () => this.source.getDailyObservations(place),
    );

    return reading.days.map((day) => {
      if (!hasFactor(day.observation)) throw noFactor();
      return computeTouringIndex({
        place,
        target: { type: "day", date: day.date },
        observation: day.observation,
        source: reading.source,
        fetchedAt: reading.fetchedAt,
      });
    });
  }
}
