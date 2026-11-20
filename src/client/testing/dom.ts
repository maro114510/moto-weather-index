import { afterEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

/**
 * The server tests share this process and expect Bun's own network and URL
 * classes, so only the DOM globals the happy-dom window adds are kept.
 */
const keep = [
  "fetch",
  "Request",
  "Response",
  "Headers",
  "URL",
  "URLSearchParams",
  "AbortController",
  "AbortSignal",
  "FormData",
  "Blob",
  "File",
  "ReadableStream",
  "WritableStream",
  "TransformStream",
  "TextEncoder",
  "TextDecoder",
  "WebSocket",
] as const;

const original = Object.fromEntries(
  keep.map((name) => [name, (globalThis as Record<string, unknown>)[name]]),
);

GlobalRegistrator.register({ url: "http://localhost/" });

for (const name of keep) {
  Object.defineProperty(globalThis, name, {
    value: original[name],
    configurable: true,
    writable: true,
  });
}

const { cleanup } = await import("@testing-library/react");

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
