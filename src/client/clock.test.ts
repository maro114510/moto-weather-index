import { describe, expect, test } from "bun:test";
import { addDays, jstHour, jstToday } from "./clock";

describe("jstToday", () => {
  test("is the next calendar day once Japan has passed midnight while UTC has not", () => {
    expect(jstToday(new Date("2026-11-20T15:30:00Z"))).toBe("2026-11-21");
  });

  test("is the same calendar day before Japan reaches midnight", () => {
    expect(jstToday(new Date("2026-11-20T14:59:00Z"))).toBe("2026-11-20");
  });
});

describe("jstHour", () => {
  test("is the hour in Japan, nine ahead of UTC", () => {
    expect(jstHour(new Date("2026-11-20T02:30:00Z"))).toBe(11);
  });

  test("is 0 at Japan midnight, never 24", () => {
    expect(jstHour(new Date("2026-11-20T15:00:00Z"))).toBe(0);
  });
});

describe("addDays", () => {
  test("crosses a month end", () => {
    expect(addDays("2026-11-28", 3)).toBe("2026-12-01");
  });

  test("crosses a year end", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  test("handles a leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});
