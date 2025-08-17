import { describe, expect, test } from "bun:test";
import {
  CloudflareBindingsSchema,
  EnvironmentSchema,
  validateCloudflareBindings,
  validateEnvironment,
} from "./environmentValidation";

describe("EnvironmentSchema", () => {
  test("should validate with default values", () => {
    const result = EnvironmentSchema.parse({});

    expect(result.NODE_ENV).toBe("development");
    expect(result.PORT).toBe(8000);
    expect(result.LOG_LEVEL).toBe("INFO");
    expect(result.BATCH_SECRET).toBeUndefined();
    expect(result.BATCH_START_DATE).toBeUndefined();
  });

  test("should validate production environment", () => {
    const env = {
      NODE_ENV: "production",
      PORT: "3000",
      LOG_LEVEL: "WARN",
      BATCH_SECRET: "this-is-a-very-secure-32-character-secret-key",
      BATCH_START_DATE: "2025-08-20", // Within valid range
    };

    const result = EnvironmentSchema.parse(env);

    expect(result.NODE_ENV).toBe("production");
    expect(result.PORT).toBe(3000);
    expect(result.LOG_LEVEL).toBe("WARN");
    expect(result.BATCH_SECRET).toBe(
      "this-is-a-very-secure-32-character-secret-key",
    );
    expect(result.BATCH_START_DATE).toBe("2025-08-20");
  });

  test("should reject invalid PORT", () => {
    expect(() => {
      EnvironmentSchema.parse({ PORT: "invalid" });
    }).toThrow("PORT must be a valid port number");

    expect(() => {
      EnvironmentSchema.parse({ PORT: "0" });
    }).toThrow("PORT must be a valid port number");

    expect(() => {
      EnvironmentSchema.parse({ PORT: "70000" });
    }).toThrow("PORT must be a valid port number");
  });

  test("should reject invalid NODE_ENV", () => {
    expect(() => {
      EnvironmentSchema.parse({ NODE_ENV: "invalid" });
    }).toThrow();
  });

  test("should reject invalid LOG_LEVEL", () => {
    expect(() => {
      EnvironmentSchema.parse({ LOG_LEVEL: "INVALID" });
    }).toThrow();
  });

  test("should reject short BATCH_SECRET", () => {
    expect(() => {
      EnvironmentSchema.parse({ BATCH_SECRET: "short" });
    }).toThrow("BATCH_SECRET must be at least 32 characters long");
  });

  test("should reject invalid BATCH_START_DATE format", () => {
    expect(() => {
      EnvironmentSchema.parse({ BATCH_START_DATE: "2025-13-32" });
    }).toThrow();

    expect(() => {
      EnvironmentSchema.parse({ BATCH_START_DATE: "invalid-date" });
    }).toThrow("BATCH_START_DATE must be in YYYY-MM-DD format");
  });

  test("should reject BATCH_START_DATE outside valid range", () => {
    // Test date too far in the past
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 30);
    const pastDateString = pastDate.toISOString().split("T")[0];

    expect(() => {
      EnvironmentSchema.parse({ BATCH_START_DATE: pastDateString });
    }).toThrow(
      "BATCH_START_DATE must be within the last 7 days or up to 16 days in the future",
    );

    // Test date too far in the future
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const futureDateString = futureDate.toISOString().split("T")[0];

    expect(() => {
      EnvironmentSchema.parse({ BATCH_START_DATE: futureDateString });
    }).toThrow(
      "BATCH_START_DATE must be within the last 7 days or up to 16 days in the future",
    );
  });
});

describe("CloudflareBindingsSchema", () => {
  test("should validate valid bindings", () => {
    const bindings = {
      DB: { prepare: jest.fn() }, // Mock D1 binding
      OPEN_METEO_CACHE: { get: jest.fn(), put: jest.fn() }, // Mock KV binding
    };

    const result = CloudflareBindingsSchema.parse(bindings);

    expect(result.DB).toBeDefined();
    expect(result.OPEN_METEO_CACHE).toBeDefined();
  });

  test("should reject missing DB binding", () => {
    expect(() => {
      CloudflareBindingsSchema.parse({
        OPEN_METEO_CACHE: { get: jest.fn(), put: jest.fn() },
      });
    }).toThrow("DB binding is required");
  });

  test("should reject missing KV binding", () => {
    expect(() => {
      CloudflareBindingsSchema.parse({
        DB: { prepare: jest.fn() },
      });
    }).toThrow("OPEN_METEO_CACHE KV binding is required");
  });
});

describe("validateEnvironment", () => {
  test("should return validated environment", () => {
    const env = {
      NODE_ENV: "test",
      PORT: "8080",
      LOG_LEVEL: "DEBUG",
    };

    const result = validateEnvironment(env);

    expect(result.NODE_ENV).toBe("test");
    expect(result.PORT).toBe(8080);
    expect(result.LOG_LEVEL).toBe("DEBUG");
  });

  test("should throw descriptive error for invalid environment", () => {
    const env = {
      NODE_ENV: "invalid",
      PORT: "not-a-number",
    };

    expect(() => {
      validateEnvironment(env);
    }).toThrow("PORT must be a valid port number");
  });
});

describe("validateCloudflareBindings", () => {
  test("should return validated bindings", () => {
    const bindings = {
      DB: { prepare: jest.fn() },
      OPEN_METEO_CACHE: { get: jest.fn(), put: jest.fn() },
    };

    const result = validateCloudflareBindings(bindings);

    expect(result.DB).toBeDefined();
    expect(result.OPEN_METEO_CACHE).toBeDefined();
  });

  test("should throw descriptive error for invalid bindings", () => {
    const bindings = {
      DB: null,
      OPEN_METEO_CACHE: undefined,
    };

    expect(() => {
      validateCloudflareBindings(bindings);
    }).toThrow("Cloudflare bindings validation failed");
  });
});

// Mock jest functions since we're using Bun test
const jest = {
  fn: () => ({}),
};
