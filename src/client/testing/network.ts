import { afterEach, beforeEach } from "bun:test";

type Handler = (url: URL) => Response | Promise<Response>;

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Replaces fetch for each test with the handler the test installs, and records
 * every URL the interface asked for.
 */
export function useFakeApi() {
  const original = globalThis.fetch;
  const requests: URL[] = [];
  let handler: Handler = () => json({ error: "not stubbed" }, 500);

  beforeEach(() => {
    requests.length = 0;
    handler = () => json({ error: "not stubbed" }, 500);
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(
        typeof input === "string" ? input : input.toString(),
        "http://localhost",
      );
      requests.push(url);
      return handler(url);
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = original;
  });

  return {
    requests,
    answer(next: Handler) {
      handler = next;
    },
  };
}
