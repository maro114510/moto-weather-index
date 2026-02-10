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

  test("handles circular structures while redacting sensitive keys", () => {
    const input: Record<string, unknown> = {
      token: "abc123",
      nested: {
        apiKey: "secret-key",
      },
    };
    input.self = input;

    const output = sanitizeLogData(input) as Record<string, unknown>;
    expect(output.token).toBe("***");
    expect((output.nested as Record<string, unknown>).apiKey).toBe("***");
    expect(output.self).toBe("[Circular]");
  });

  test("redacts sensitive keys inside arrays", () => {
    const input = {
      users: [
        { name: "alice", authorization: "Bearer aaa" },
        { name: "bob", password: "pw" },
      ],
    };

    const output = sanitizeLogData(input);
    expect(output.users[0].authorization).toBe("***");
    expect(output.users[1].password).toBe("***");
    expect(output.users[0].name).toBe("alice");
  });
});
