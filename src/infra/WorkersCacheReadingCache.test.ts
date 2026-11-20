import { describe, expect, test } from "bun:test";
import {
  READING_CACHE_TTL_SECONDS,
  WorkersCacheReadingCache,
} from "./WorkersCacheReadingCache";

/** The Workers Cache API keyed by URL, as far as the adapter uses it. */
function fakeCache() {
  const entries = new Map<string, Response>();
  const puts: { url: string; response: Response }[] = [];
  const cache = {
    async match(request: Request | string) {
      const url = typeof request === "string" ? request : request.url;
      return entries.get(url)?.clone();
    },
    async put(request: Request | string, response: Response) {
      const url = typeof request === "string" ? request : request.url;
      puts.push({ url, response: response.clone() });
      entries.set(url, response);
    },
  } as unknown as Cache;
  return { cache, puts };
}

describe("WorkersCacheReadingCache", () => {
  test("returns what was put under the same key", async () => {
    const { cache } = fakeCache();
    const adapter = new WorkersCacheReadingCache(cache);

    await adapter.put("index:35.66,139.71:2026-11-20T10", { a: [1, 2] });

    expect(await adapter.get("index:35.66,139.71:2026-11-20T10")).toEqual({
      a: [1, 2],
    });
  });

  test("returns undefined for a key never stored", async () => {
    const adapter = new WorkersCacheReadingCache(fakeCache().cache);

    expect(await adapter.get("index:none")).toBeUndefined();
  });

  test("keeps keys apart, so an hour never answers for another hour", async () => {
    const adapter = new WorkersCacheReadingCache(fakeCache().cache);

    await adapter.put("index:35.66,139.71:2026-11-20T10", { hour: 10 });

    expect(
      await adapter.get("index:35.66,139.71:2026-11-20T11"),
    ).toBeUndefined();
  });

  test("stores an entry for ten minutes", async () => {
    const { cache, puts } = fakeCache();
    const adapter = new WorkersCacheReadingCache(cache);

    await adapter.put("k", { a: 1 });

    expect(READING_CACHE_TTL_SECONDS).toBe(600);
    expect(puts[0].response.headers.get("cache-control")).toBe("max-age=600");
  });

  test("stores the entry under a URL the key cannot escape from", async () => {
    const { cache, puts } = fakeCache();
    const adapter = new WorkersCacheReadingCache(cache);

    await adapter.put("a/b?c=d#e", { a: 1 });

    const url = new URL(puts[0].url);
    expect(url.search).toBe("");
    expect(url.hash).toBe("");
    expect(await adapter.get("a/b?c=d#e")).toEqual({ a: 1 });
  });
});
