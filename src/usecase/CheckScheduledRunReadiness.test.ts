import { beforeEach, describe, expect, mock, test } from "bun:test";
import { CheckScheduledRunReadinessUseCase } from "./CheckScheduledRunReadiness";
import type {
  ScheduledRunRecord,
  ScheduledRunRepository,
} from "./RecordScheduledRunOutcome";

const THRESHOLD_MS = 2 * 60 * 60 * 1000;

function buildRun(
  overrides: Partial<ScheduledRunRecord> = {},
): ScheduledRunRecord {
  return {
    runId: "run-1",
    startedAt: "2026-08-11T04:00:00.000Z",
    finishedAt: "2026-08-11T04:05:00.000Z",
    status: "success",
    expectedCount: 658,
    committedCount: 658,
    failureCount: 0,
    durationMs: 300_000,
    ...overrides,
  };
}

describe("CheckScheduledRunReadinessUseCase", () => {
  let mockRepository: ScheduledRunRepository;
  let usecase: CheckScheduledRunReadinessUseCase;

  beforeEach(() => {
    mockRepository = {
      recordRun: mock(async () => {}),
      getLatestRun: mock(async () => null),
    };
    usecase = new CheckScheduledRunReadinessUseCase(
      mockRepository,
      THRESHOLD_MS,
    );
  });

  test("is not ready when no run has ever been recorded", async () => {
    const result = await usecase.check(new Date("2026-08-11T05:00:00.000Z"));

    expect(result.ready).toBe(false);
    expect(result.reason).toBe("no_run_recorded");
    expect(result.lastRun).toBeNull();
  });

  test("is not ready when the latest run is partial, regardless of freshness", async () => {
    mockRepository.getLatestRun = mock(async () =>
      buildRun({ status: "partial", finishedAt: "2026-08-11T04:59:00.000Z" }),
    );

    const result = await usecase.check(new Date("2026-08-11T05:00:00.000Z"));

    expect(result.ready).toBe(false);
    expect(result.reason).toBe("incomplete_coverage");
  });

  test("is not ready when the latest run failed, regardless of freshness", async () => {
    mockRepository.getLatestRun = mock(async () =>
      buildRun({ status: "failed", finishedAt: "2026-08-11T04:59:00.000Z" }),
    );

    const result = await usecase.check(new Date("2026-08-11T05:00:00.000Z"));

    expect(result.ready).toBe(false);
    expect(result.reason).toBe("incomplete_coverage");
  });

  test("is not ready when the latest successful run is older than the threshold", async () => {
    mockRepository.getLatestRun = mock(async () =>
      buildRun({ status: "success", finishedAt: "2026-08-11T00:00:00.000Z" }),
    );

    const result = await usecase.check(new Date("2026-08-11T05:00:00.000Z"));

    expect(result.ready).toBe(false);
    expect(result.reason).toBe("stale");
    expect(result.ageMs).toBe(5 * 60 * 60 * 1000);
  });

  test("is ready when the latest run succeeded within the freshness threshold", async () => {
    mockRepository.getLatestRun = mock(async () =>
      buildRun({ status: "success", finishedAt: "2026-08-11T04:00:00.000Z" }),
    );

    const result = await usecase.check(new Date("2026-08-11T05:00:00.000Z"));

    expect(result.ready).toBe(true);
    expect(result.reason).toBe("ok");
    expect(result.ageMs).toBe(60 * 60 * 1000);
  });

  test("is ready exactly at the threshold boundary", async () => {
    mockRepository.getLatestRun = mock(async () =>
      buildRun({ status: "success", finishedAt: "2026-08-11T03:00:00.000Z" }),
    );

    const result = await usecase.check(new Date("2026-08-11T05:00:00.000Z"));

    expect(result.ready).toBe(true);
    expect(result.reason).toBe("ok");
  });
});
