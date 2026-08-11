import { beforeEach, describe, expect, mock, test } from "bun:test";
import { APP_CONFIG } from "../../constants/appConfig";
import type { BatchProcessResult } from "../../usecase/BatchCalculateTouringIndex";

const mockCreateWeatherRepository = mock();
const mockCreateTouringIndexRepository = mock();
const mockCreateBatchCalculateTouringIndexUsecase = mock();

mock.module("../../di/container", () => ({
  createWeatherRepository: mockCreateWeatherRepository,
  createTouringIndexRepository: mockCreateTouringIndexRepository,
  createBatchCalculateTouringIndexUsecase:
    mockCreateBatchCalculateTouringIndexUsecase,
}));

// Imported after mock.module so the handler picks up the mocked DI container.
const { scheduledHandler } = await import("./scheduledHandler");

function buildResult(
  overrides: Partial<BatchProcessResult> = {},
): BatchProcessResult {
  return {
    total_processed: 47,
    successful_inserts: 47,
    failed_inserts: 0,
    errors: [],
    ...overrides,
  };
}

describe("scheduledHandler", () => {
  const fakeEnv = {
    DB: {} as any,
    WEATHERAPI_KEY: "dummy-key",
  };
  const fakeController = {} as ScheduledController;
  const fakeCtx = {} as any;

  let mockExecute: ReturnType<typeof mock>;

  beforeEach(() => {
    mockCreateWeatherRepository.mockClear();
    mockCreateTouringIndexRepository.mockClear();
    mockCreateBatchCalculateTouringIndexUsecase.mockClear();

    mockCreateWeatherRepository.mockReturnValue({});
    mockCreateTouringIndexRepository.mockReturnValue({});

    mockExecute = mock();
    mockCreateBatchCalculateTouringIndexUsecase.mockReturnValue({
      execute: mockExecute,
    });
  });

  test("resolves without throwing when the batch completes with zero errors", async () => {
    mockExecute.mockResolvedValue(buildResult());

    await expect(
      scheduledHandler(fakeController, fakeEnv as any, fakeCtx),
    ).resolves.toBeUndefined();
  });

  test("passes MAX_FORECAST_DAYS target dates to the usecase, not a hardcoded 16", async () => {
    mockExecute.mockResolvedValue(buildResult());

    await scheduledHandler(fakeController, fakeEnv as any, fakeCtx);

    const targetDates = mockExecute.mock.calls[0][0] as string[];
    expect(targetDates).toHaveLength(APP_CONFIG.MAX_FORECAST_DAYS);
  });

  test("throws when the batch completes with a partial failure", async () => {
    mockExecute.mockResolvedValue(
      buildResult({
        successful_inserts: 40,
        failed_inserts: 7,
        errors: [{ prefecture_id: 1, date: "2026-08-11", error: "boom" }],
      }),
    );

    await expect(
      scheduledHandler(fakeController, fakeEnv as any, fakeCtx),
    ).rejects.toThrow(/incomplete/i);
  });

  test("throws when the batch fails completely", async () => {
    mockExecute.mockResolvedValue(
      buildResult({
        successful_inserts: 0,
        failed_inserts: 47,
        errors: [{ prefecture_id: 1, date: "2026-08-11", error: "boom" }],
      }),
    );

    await expect(
      scheduledHandler(fakeController, fakeEnv as any, fakeCtx),
    ).rejects.toThrow(/incomplete/i);
  });

  test("propagates the original error when execute() itself rejects", async () => {
    mockExecute.mockRejectedValue(new Error("DB unreachable"));

    await expect(
      scheduledHandler(fakeController, fakeEnv as any, fakeCtx),
    ).rejects.toThrow("DB unreachable");
  });
});
