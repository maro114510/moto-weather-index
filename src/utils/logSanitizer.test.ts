import { describe, expect, test } from "bun:test";
import { sanitizeLogData } from "./logSanitizer";

describe("sanitizeLogData", () => {
  test("redacts sensitive key values", () => {
    const input = {
      apiKey: "secret",
      Authorization: "Bearer token",
      nested: {
        xTouringAuth: "sig",
      },
      normal: "visible",
    };

    const output = sanitizeLogData(input);
    expect(output.apiKey).toBe("***");
    expect(output.Authorization).toBe("***");
    expect(output.nested.xTouringAuth).toBe("***");
    expect(output.normal).toBe("visible");
  });

  test("sanitizes sensitive query parameters in strings", () => {
    const input =
      "https://example.com?token=abc123&password=pass&normal=visible";
    const output = sanitizeLogData(input);
    expect(output).toContain("token=***");
    expect(output).toContain("password=***");
    expect(output).toContain("normal=visible");
  });
});
