import { beforeEach, describe, expect, mock, test } from "bun:test";
import { APP_CONFIG } from "../../constants/appConfig";
import type { BatchProcessResult } from "../../usecase/BatchCalculateTouringIndex";

const mockCreateWeatherRepository = mock();
const mockCreateTouringIndexRepository = mock();
const mockCreateBatchCalculateTouringIndexUsecase = mock();
const mockCreateScheduledRunRepository = mock();
const mockCreateRecordScheduledRunOutcomeUseCase = mock();

mock.module("../../di/container", () => ({
  createWeatherRepository: mockCreateWeatherRepository,
  createTouringIndexRepository: mockCreateTouringIndexRepository,
  createBatchCalculateTouringIndexUsecase:
    mockCreateBatchCalculateTouringIndexUsecase,
  createScheduledRunRepository: mockCreateScheduledRunRepository,
  createRecordScheduledRunOutcomeUseCase:
    mockCreateRecordScheduledRunOutcomeUseCase,
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
  let mockGetCommittedCoverageCount: ReturnType<typeof mock>;
  let mockRecordOutcome: ReturnType<typeof mock>;
  let mockRecordFailure: ReturnType<typeof mock>;

  beforeEach(() => {
    mockCreateWeatherRepository.mockClear();
    mockCreateTouringIndexRepository.mockClear();
    mockCreateBatchCalculateTouringIndexUsecase.mockClear();
    mockCreateScheduledRunRepository.mockClear();
    mockCreateRecordScheduledRunOutcomeUseCase.mockClear();

    mockCreateWeatherRepository.mockReturnValue({});

    mockGetCommittedCoverageCount = mock(async () => 47);
    mockCreateTouringIndexRepository.mockReturnValue({
      getCommittedCoverageCount: mockGetCommittedCoverageCount,
    });

    mockExecute = mock();
    mockCreateBatchCalculateTouringIndexUsecase.mockReturnValue({
      execute: mockExecute,
    });

    mockCreateScheduledRunRepository.mockReturnValue({});

    mockRecordOutcome = mock(async (input: any) => ({
      ...input,
      status: "success",
    }));
    mockRecordFailure = mock(async (input: any) => ({
      ...input,
      status: "failed",
      expectedCount: 0,
      committedCount: 0,
      failureCount: 1,
    }));
    mockCreateRecordScheduledRunOutcomeUseCase.mockReturnValue({
      recordOutcome: mockRecordOutcome,
      recordFailure: mockRecordFailure,
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

  test("records a run outcome from actual D1 coverage, not the usecase's self-reported counters", async () => {
    mockExecute.mockResolvedValue(buildResult());
    mockGetCommittedCoverageCount.mockResolvedValue(658);

    await scheduledHandler(fakeController, fakeEnv as any, fakeCtx);

    expect(mockGetCommittedCoverageCount).toHaveBeenCalledTimes(1);
    expect(mockRecordOutcome).toHaveBeenCalledTimes(1);

    // The coverage count must be scoped to this run's start time, not any
    // row in the date range — otherwise leftover rows from a previous
    // successful run could mask a partial failure in this run.
    const coverageArgs = mockGetCommittedCoverageCount.mock.calls[0];
    expect(coverageArgs).toHaveLength(3);
    expect(typeof coverageArgs[2]).toBe("string");

    const call = mockRecordOutcome.mock.calls[0][0];
    expect(call.committedCount).toBe(658);
    expect(call.expectedCount).toBe(47);
    expect(call.failureCount).toBe(0);
    expect(typeof call.runId).toBe("string");
    expect(call.runId.length).toBeGreaterThan(0);
    expect(typeof call.startedAt).toBe("string");
    expect(typeof call.finishedAt).toBe("string");
    expect(typeof call.durationMs).toBe("number");
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

    expect(mockRecordOutcome).toHaveBeenCalledTimes(1);
    expect(mockRecordFailure).not.toHaveBeenCalled();
    expect(mockRecordOutcome.mock.calls[0][0].failureCount).toBe(1);
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

  test("throws when outcome status is incomplete even though the usecase reported zero errors", async () => {
    mockExecute.mockResolvedValue(buildResult());
    mockGetCommittedCoverageCount.mockResolvedValue(600);
    mockRecordOutcome.mockResolvedValue({
      status: "partial",
      committedCount: 600,
      expectedCount: 658,
      failureCount: 0,
    });

    await expect(
      scheduledHandler(fakeController, fakeEnv as any, fakeCtx),
    ).rejects.toThrow(/incomplete/i);
  });

  test("propagates the original error when execute() itself rejects, and records a failure outcome", async () => {
    mockExecute.mockRejectedValue(new Error("DB unreachable"));

    await expect(
      scheduledHandler(fakeController, fakeEnv as any, fakeCtx),
    ).rejects.toThrow("DB unreachable");

    expect(mockRecordFailure).toHaveBeenCalledTimes(1);
    expect(mockRecordOutcome).not.toHaveBeenCalled();

    const call = mockRecordFailure.mock.calls[0][0];
    expect(call.errorSummary).toBe("DB unreachable");
    expect(typeof call.runId).toBe("string");
  });

  test("does not let a recording failure mask the original batch error", async () => {
    mockExecute.mockRejectedValue(new Error("DB unreachable"));
    mockRecordFailure.mockRejectedValue(new Error("telemetry write failed"));

    await expect(
      scheduledHandler(fakeController, fakeEnv as any, fakeCtx),
    ).rejects.toThrow("DB unreachable");
  });
});
