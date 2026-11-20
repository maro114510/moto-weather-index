import type { ReadingCache } from "../usecase/TouringIndexService";

export const READING_CACHE_TTL_SECONDS = 600;

/** The Cache API needs a URL, and the host is never contacted. */
const CACHE_ORIGIN = "https://reading-cache.invalid/";

export class WorkersCacheReadingCache implements ReadingCache {
  constructor(private readonly cache: Cache) {}

  private requestFor(key: string): Request {
    return new Request(CACHE_ORIGIN + encodeURIComponent(key));
  }

  async get(key: string): Promise<unknown | undefined> {
    const hit = await this.cache.match(this.requestFor(key));
    return hit ? await hit.json() : undefined;
  }

  async put(key: string, value: unknown): Promise<void> {
    await this.cache.put(
      this.requestFor(key),
      new Response(JSON.stringify(value), {
        headers: {
          "content-type": "application/json",
          "cache-control": `max-age=${READING_CACHE_TTL_SECONDS}`,
        },
      }),
    );
  }
}
