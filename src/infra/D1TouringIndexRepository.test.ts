import { describe, expect, mock, test } from "bun:test";
import type { TouringIndexBatchItem } from "../usecase/BatchCalculateTouringIndex";
import { D1TouringIndexRepository } from "./D1TouringIndexRepository";

const items: TouringIndexBatchItem[] = [
  {
    prefecture_id: 13,
    date: "2026-08-11",
    score: 90,
    weather_factors_json: '{"weather":30}',
    weather_raw_json: '{"condition":"clear"}',
  },
  {
    prefecture_id: 13,
    date: "2026-08-12",
    score: 85,
    weather_factors_json: '{"weather":25}',
    weather_raw_json: '{"condition":"cloudy"}',
  },
];

function successfulResult(): D1Result {
  return {
    success: true,
    meta: {
      duration: 0,
      size_after: 0,
      rows_read: 0,
      rows_written: 1,
    },
    changes: 1,
    duration: 0,
    last_row_id: 0,
  };
}

describe("D1TouringIndexRepository", () => {
  test("publishes a prefecture range in one idempotent D1 batch", async () => {
    const bind = mock(() => ({}) as D1PreparedStatement);
    const prepare = mock(() => ({ bind }) as unknown as D1PreparedStatement);
    const batch = mock(async () => [successfulResult(), successfulResult()]);
    const repository = new D1TouringIndexRepository({
      prepare,
      batch,
    } as unknown as D1Database);

    await expect(repository.upsertTouringIndexes(items)).resolves.toBe(2);

    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0][0]).toHaveLength(2);
    expect(bind).toHaveBeenCalledTimes(2);
    expect(bind.mock.calls[0]).toEqual([
      13,
      "2026-08-11",
      90,
      '{"weather":30}',
      '{"condition":"clear"}',
      null,
    ]);

    const sql = prepare.mock.calls[0][0] as string;
    expect(sql).toContain("ON CONFLICT(prefecture_id, date) DO UPDATE");
    expect(sql).not.toContain("INSERT OR REPLACE");
  });

  test("does not report a commit when D1 does not confirm every statement", async () => {
    const bind = mock(() => ({}) as D1PreparedStatement);
    const repository = new D1TouringIndexRepository({
      prepare: mock(() => ({ bind }) as unknown as D1PreparedStatement),
      batch: mock(async () => [successfulResult()]),
    } as unknown as D1Database);

    await expect(repository.upsertTouringIndexes(items)).rejects.toThrow(
      "Failed to atomically upsert touring index range",
    );
  });
});
