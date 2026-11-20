import { describe, expect, test } from "bun:test";
import { ERROR_CODES } from "../constants/errorCodes";
import { HttpError } from "../domain/HttpError";
import shibuya from "./fixtures/openMeteo/geocoding-shibuya.json";
import { OpenMeteoGeocodingClient } from "./OpenMeteoGeocodingClient";

const GEOCODING_HOST = "geocoding-api.open-meteo.com";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function clientAnswering(respond: () => Response) {
  const urls: URL[] = [];
  const fetchFake = (async (input: RequestInfo | URL) => {
    urls.push(new URL(typeof input === "string" ? input : input.toString()));
    return respond();
  }) as typeof fetch;
  return { client: new OpenMeteoGeocodingClient({ fetch: fetchFake }), urls };
}

describe("OpenMeteoGeocodingClient.search", () => {
  test("returns each recorded candidate with its name, coordinates and region", async () => {
    const { client } = clientAnswering(() => json(structuredClone(shibuya)));

    const places = await client.search("渋谷");

    expect(places).toHaveLength(3);
    expect(places[0]).toEqual({
      name: "渋谷",
      latitude: 35.6589,
      longitude: 139.70665,
      region: "東京都 渋谷区",
    });
    expect(places[1].region).toBe("大阪府 池田市");
  });

  test("asks the geocoding host for Japan only, in Japanese, with no key", async () => {
    const { client, urls } = clientAnswering(() => json(shibuya));

    await client.search("渋谷");

    expect(urls).toHaveLength(1);
    expect(urls[0].host).toBe(GEOCODING_HOST);
    expect(urls[0].searchParams.get("name")).toBe("渋谷");
    expect(urls[0].searchParams.get("countryCode")).toBe("JP");
    expect(urls[0].searchParams.get("language")).toBe("ja");
    expect(urls[0].searchParams.get("count")).toBe("10");
    expect(urls[0].searchParams.has("apikey")).toBe(false);
  });

  test("returns no candidates when Open-Meteo finds nothing, as the response then has no results", async () => {
    const { client } = clientAnswering(() =>
      json({ generationtime_ms: 0.07402897 }),
    );

    expect(await client.search("zzzzqqqxx")).toEqual([]);
  });

  test("names a candidate by its name alone when the response has no region", async () => {
    const { client } = clientAnswering(() =>
      json({
        results: [{ name: "東京", latitude: 35.6895, longitude: 139.69171 }],
      }),
    );

    expect(await client.search("東京")).toEqual([
      { name: "東京", latitude: 35.6895, longitude: 139.69171 },
    ]);
  });

  test("fails with an invalid-response code when a coordinate is outside the range", async () => {
    const { client } = clientAnswering(() =>
      json({ results: [{ name: "x", latitude: 135, longitude: 139 }] }),
    );

    const error = await client.search("x").catch((e) => e);

    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(502);
    expect(error.code).toBe(ERROR_CODES.WEATHER_UPSTREAM_INVALID_RESPONSE);
  });

  test("fails with 503 and an unavailable code when Open-Meteo answers 500", async () => {
    const { client } = clientAnswering(() => json({}, 500));

    const error = await client.search("渋谷").catch((e) => e);

    expect(error.status).toBe(503);
    expect(error.code).toBe(ERROR_CODES.WEATHER_UPSTREAM_UNAVAILABLE);
  });
});
