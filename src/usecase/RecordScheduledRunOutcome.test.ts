import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  RecordScheduledRunOutcomeUseCase,
  type ScheduledRunRepository,
} from "./RecordScheduledRunOutcome";

describe("RecordScheduledRunOutcomeUseCase", () => {
  let mockRepository: ScheduledRunRepository;
  let usecase: RecordScheduledRunOutcomeUseCase;

  beforeEach(() => {
    mockRepository = {
      recordRun: mock(async () => {}),
      getLatestRun: mock(async () => null),
    };
    usecase = new RecordScheduledRunOutcomeUseCase(mockRepository);
  });

  describe("recordOutcome", () => {
    test("marks the run 'success' when committed count meets expected count", async () => {
      const record = await usecase.recordOutcome({
        runId: "run-1",
        startedAt: "2026-08-11T04:00:00.000Z",
        finishedAt: "2026-08-11T04:05:00.000Z",
        expectedCount: 658,
        committedCount: 658,
        failureCount: 0,
        durationMs: 300_000,
      });

      expect(record.status).toBe("success");
      expect(mockRepository.recordRun).toHaveBeenCalledWith(record);
    });

    test("marks the run 'partial' when committed count is below expected but nonzero", async () => {
      const record = await usecase.recordOutcome({
        runId: "run-2",
        startedAt: "2026-08-11T04:00:00.000Z",
        finishedAt: "2026-08-11T04:05:00.000Z",
        expectedCount: 658,
        committedCount: 600,
        failureCount: 1,
        durationMs: 300_000,
      });

      expect(record.status).toBe("partial");
    });

    test("marks the run 'failed' when nothing was committed", async () => {
      const record = await usecase.recordOutcome({
        runId: "run-3",
        startedAt: "2026-08-11T04:00:00.000Z",
        finishedAt: "2026-08-11T04:05:00.000Z",
        expectedCount: 658,
        committedCount: 0,
        failureCount: 47,
        durationMs: 300_000,
      });

      expect(record.status).toBe("failed");
    });

    test("propagates errorSummary through to the persisted record", async () => {
      const record = await usecase.recordOutcome({
        runId: "run-4",
        startedAt: "2026-08-11T04:00:00.000Z",
        finishedAt: "2026-08-11T04:05:00.000Z",
        expectedCount: 658,
        committedCount: 600,
        failureCount: 1,
        durationMs: 300_000,
        errorSummary: "1 prefecture(s) failed",
      });

      expect(record.errorSummary).toBe("1 prefecture(s) failed");
    });
  });

  describe("recordFailure", () => {
    test("always records status 'failed' with zeroed coverage counts", async () => {
      const record = await usecase.recordFailure({
        runId: "run-5",
        startedAt: "2026-08-11T04:00:00.000Z",
        finishedAt: "2026-08-11T04:00:01.000Z",
        durationMs: 1_000,
        errorSummary: "DB unreachable",
      });

      expect(record.status).toBe("failed");
      expect(record.expectedCount).toBe(0);
      expect(record.committedCount).toBe(0);
      expect(mockRepository.recordRun).toHaveBeenCalledWith(record);
    });
  });
});
