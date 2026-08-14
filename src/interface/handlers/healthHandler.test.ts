import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Context } from "hono";
import { HTTP_STATUS } from "../../constants/httpStatus";

const mockCreateScheduledRunRepository = mock();
const mockCreateCheckScheduledRunReadinessUseCase = mock();

mock.module("../../di/container", () => ({
  createScheduledRunRepository: mockCreateScheduledRunRepository,
  createCheckScheduledRunReadinessUseCase:
    mockCreateCheckScheduledRunReadinessUseCase,
}));

const { healthCheck, readinessCheck } = await import("./healthHandler");

function buildContext(): {
  context: Partial<Context>;
  captured: { data: any; status: number };
} {
  const captured = { data: {} as any, status: 200 };
  const context: Partial<Context> = {
    get: mock(() => ({})),
    json: mock((data: any, status?: any) => {
      captured.data = data;
      captured.status = status || 200;
      return {} as any;
    }) as any,
    env: { DB: {} as any } as any,
  };
  return { context, captured };
}

describe("healthCheck", () => {
  test("always returns ok (liveness)", () => {
    const { context, captured } = buildContext();

    healthCheck(context as Context);

    expect(captured.data.status).toBe("ok");
    expect(captured.status).toBe(HTTP_STATUS.OK);
  });
});

describe("readinessCheck", () => {
  let mockCheck: ReturnType<typeof mock>;

  beforeEach(() => {
    mockCreateScheduledRunRepository.mockClear();
    mockCreateCheckScheduledRunReadinessUseCase.mockClear();

    mockCreateScheduledRunRepository.mockReturnValue({});
    mockCheck = mock();
    mockCreateCheckScheduledRunReadinessUseCase.mockReturnValue({
      check: mockCheck,
    });
  });

  test("returns 200 when the latest run is fresh and complete", async () => {
    mockCheck.mockResolvedValue({
      ready: true,
      reason: "ok",
      lastRun: {
        runId: "run-1",
        status: "success",
        finishedAt: "2026-08-11T04:05:00.000Z",
        expectedCount: 658,
        committedCount: 658,
      },
      ageMs: 3_600_000,
      thresholdMs: 93_600_000,
    });

    const { context, captured } = buildContext();
    await readinessCheck(context as Context);

    expect(captured.status).toBe(HTTP_STATUS.OK);
    expect(captured.data.ready).toBe(true);
    expect(captured.data.reason).toBe("ok");
    expect(captured.data.lastRun.runId).toBe("run-1");
  });

  test("returns 503 when no run has ever been recorded", async () => {
    mockCheck.mockResolvedValue({
      ready: false,
      reason: "no_run_recorded",
      lastRun: null,
      ageMs: null,
      thresholdMs: 93_600_000,
    });

    const { context, captured } = buildContext();
    await readinessCheck(context as Context);

    expect(captured.status).toBe(HTTP_STATUS.SERVICE_UNAVAILABLE);
    expect(captured.data.ready).toBe(false);
    expect(captured.data.lastRun).toBeNull();
  });

  test("returns 503 when the latest run has incomplete coverage", async () => {
    mockCheck.mockResolvedValue({
      ready: false,
      reason: "incomplete_coverage",
      lastRun: {
        runId: "run-2",
        status: "partial",
        finishedAt: "2026-08-11T04:05:00.000Z",
        expectedCount: 658,
        committedCount: 600,
      },
      ageMs: null,
      thresholdMs: 93_600_000,
    });

    const { context, captured } = buildContext();
    await readinessCheck(context as Context);

    expect(captured.status).toBe(HTTP_STATUS.SERVICE_UNAVAILABLE);
    expect(captured.data.reason).toBe("incomplete_coverage");
  });

  test("returns 503 when the latest successful run is stale", async () => {
    mockCheck.mockResolvedValue({
      ready: false,
      reason: "stale",
      lastRun: {
        runId: "run-3",
        status: "success",
        finishedAt: "2026-08-09T04:05:00.000Z",
        expectedCount: 658,
        committedCount: 658,
      },
      ageMs: 200_000_000,
      thresholdMs: 93_600_000,
    });

    const { context, captured } = buildContext();
    await readinessCheck(context as Context);

    expect(captured.status).toBe(HTTP_STATUS.SERVICE_UNAVAILABLE);
    expect(captured.data.reason).toBe("stale");
    expect(captured.data.ageMs).toBe(200_000_000);
  });
});
