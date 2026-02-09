import { beforeEach, describe, expect, mock, test } from "bun:test";
import { ERROR_CODES } from "../constants/errorCodes";
import { HTTP_STATUS } from "../constants/httpStatus";

const mockAxiosGet = mock();
const mockLogger = {
  debug: mock(),
  info: mock(),
  warn: mock(),
  error: mock(),
  apiRequest: mock(),
  apiResponse: mock(),
  externalApiCall: mock(),
  externalApiResponse: mock(),
  dbOperation: mock(),
  cacheOperation: mock(),
  businessLogic: mock(),
};

mock.module("axios", () => {
  const isAxiosError = (err: unknown) =>
    !!err && typeof err === "object" && (err as any).isAxiosError === true;

  return {
    default: {
      get: mockAxiosGet,
      isAxiosError,
    },
    isAxiosError,
  };
});

mock.module("../utils/logger", () => ({
  logger: mockLogger,
}));

import { WeatherApiWeatherRepository } from "./WeatherApiWeatherRepository";

describe("WeatherApiWeatherRepository coordinate-dependent upstream errors", () => {
  beforeEach(() => {
    process.env.WEATHERAPI_KEY = "test-key";
    mockAxiosGet.mockReset();
    mockLogger.debug.mockReset();
    mockLogger.info.mockReset();
    mockLogger.warn.mockReset();
    mockLogger.error.mockReset();
    mockLogger.apiRequest.mockReset();
    mockLogger.apiResponse.mockReset();
    mockLogger.externalApiCall.mockReset();
    mockLogger.externalApiResponse.mockReset();
    mockLogger.dbOperation.mockReset();
    mockLogger.cacheOperation.mockReset();
    mockLogger.businessLogic.mockReset();
  });

  test("maps WeatherAPI no-location error (code=1006) to 404 with coordinate context", async () => {
    mockAxiosGet.mockRejectedValue({
      isAxiosError: true,
      code: "ERR_BAD_REQUEST",
      response: {
        status: 400,
        statusText: "Bad Request",
        data: {
          error: {
            code: 1006,
            message: "No matching location found.",
          },
        },
      },
    });

    const repository = new WeatherApiWeatherRepository();

    await expect(
      repository.getWeather(0, -140, "2026-02-09T00:00:00Z"),
    ).rejects.toMatchObject({
      status: HTTP_STATUS.NOT_FOUND,
      code: ERROR_CODES.WEATHER_DATA_NOT_FOUND,
    });

    const hasContextLog = mockLogger.error.mock.calls.some(
      ([message, context]) =>
        message === "WeatherAPI request failed" &&
        context?.location?.lat === 0 &&
        context?.location?.lon === -140 &&
        context?.statusCode === 400 &&
        context?.upstreamCode === 1006,
    );
    expect(hasContextLog).toBe(true);
  });

  test("keeps successful domestic coordinate responses unchanged", async () => {
    mockAxiosGet.mockResolvedValue({
      status: 200,
      data: {
        forecast: {
          forecastday: [
            {
              date: "2026-02-09",
              day: {
                avgtemp_c: 10.5,
                maxwind_kph: 18,
                avghumidity: 50,
                uv: 2,
                daily_chance_of_rain: "5",
                condition: { code: 1000 },
              },
            },
          ],
        },
      },
    });

    const repository = new WeatherApiWeatherRepository();
    const weather = await repository.getWeather(
      35.6762,
      139.6503,
      "2026-02-09T00:00:00Z",
    );

    expect(weather.condition).toBe("clear");
    expect(weather.temperature).toBe(10.5);
    expect(weather.windSpeed).toBeCloseTo(5, 4);
    expect(weather.humidity).toBe(50);
    expect(weather.precipitationProbability).toBe(5);
    expect(weather.uvIndex).toBe(2);
  });
});
