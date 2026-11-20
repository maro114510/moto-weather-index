import { describe, expect, test } from "bun:test";
import { ratingFor } from "../../src/domain/TouringIndex";

describe("ratingFor", () => {
  test.each([
    [100, "最高", "green"],
    [80, "最高", "green"],
    [79, "良好", "lime"],
    [60, "良好", "lime"],
    [59, "普通", "yellow"],
    [40, "普通", "yellow"],
    [39, "注意", "orange"],
    [20, "注意", "orange"],
    [19, "危険", "red"],
    [0, "危険", "red"],
  ])("score %d is rated %s in %s", (score, label, color) => {
    expect(ratingFor(score)).toEqual({ label, color });
  });

  test.each([-1, 101, 50.5, Number.NaN])("rejects score %p", (score) => {
    expect(() => ratingFor(score)).toThrow();
  });
});
