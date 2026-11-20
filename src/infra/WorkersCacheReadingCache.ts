import type { ReadingCache } from "../usecase/TouringIndexService";

export const READING_CACHE_TTL_SECONDS = 600;

export class WorkersCacheReadingCache implements ReadingCache {
  constructor(_cache: Cache) {}

  async get(_key: string): Promise<unknown | undefined> {
    return undefined;
  }

  async put(_key: string, _value: unknown): Promise<void> {}
}
