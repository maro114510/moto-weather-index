import { z } from "zod";
import { logger } from "../utils/logger.js";

/**
 * Environment variables schema for runtime validation
 */
export const EnvironmentSchema = z.object({
  // Application Environment
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development")
    .describe("Node.js environment mode"),

  // Server Configuration
  PORT: z
    .string()
    .transform((val) => {
      const port = Number.parseInt(val, 10);
      if (Number.isNaN(port) || port < 1 || port > 65535) {
        throw new Error("PORT must be a valid port number (1-65535)");
      }
      return port;
    })
    .default("8000")
    .describe("Server port number"),

  // Logging Configuration
  LOG_LEVEL: z
    .enum(["DEBUG", "INFO", "WARN", "ERROR"])
    .default("INFO")
    .describe("Logging level for the application"),

  // Security Configuration
  BATCH_SECRET: z
    .string()
    .min(32, "BATCH_SECRET must be at least 32 characters long")
    .optional()
    .describe("HMAC secret for batch operations authentication"),

  // Batch Processing Configuration
  BATCH_START_DATE: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      "BATCH_START_DATE must be in YYYY-MM-DD format",
    )
    .refine((val) => {
      const date = new Date(val);
      const [year, month, day] = val.split("-").map(Number);

      // Validate that it's a real date
      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
      ) {
        return false;
      }

      // Validate date range (within last 7 days or up to 16 days in future)
      const now = new Date();
      const minDate = new Date(now);
      minDate.setDate(now.getDate() - 7);
      const maxDate = new Date(now);
      maxDate.setDate(now.getDate() + 16);

      return date >= minDate && date <= maxDate;
    }, "BATCH_START_DATE must be within the last 7 days or up to 16 days in the future")
    .optional()
    .describe("Default start date for batch processing operations"),
});

export type Environment = z.infer<typeof EnvironmentSchema>;

/**
 * Cloudflare Workers environment bindings schema
 */
export const CloudflareBindingsSchema = z.object({
  // Cloudflare D1 Database
  DB: z
    .any()
    .refine((val) => val && typeof val === "object", "DB binding is required")
    .describe("Cloudflare D1 database binding"),

  // Cloudflare KV Storage
  OPEN_METEO_CACHE: z
    .any()
    .refine(
      (val) => val && typeof val === "object",
      "OPEN_METEO_CACHE KV binding is required",
    )
    .describe("Cloudflare KV storage for weather data caching"),
});

export type CloudflareBindings = z.infer<typeof CloudflareBindingsSchema>;

/**
 * Validate and parse environment variables
 * @param env Raw environment object (process.env or Cloudflare env)
 * @returns Validated environment configuration
 * @throws Error if validation fails
 */
export function validateEnvironment(env: Record<string, unknown>): Environment {
  try {
    const validated = EnvironmentSchema.parse(env);

    logger.info("Environment validation successful", {
      operation: "env_validation",
      nodeEnv: validated.NODE_ENV,
      logLevel: validated.LOG_LEVEL,
      port: validated.PORT,
      hasBatchSecret: !!validated.BATCH_SECRET,
      hasBatchStartDate: !!validated.BATCH_START_DATE,
    });

    return validated;
  } catch (error) {
    logger.error("Environment validation failed", {
      operation: "env_validation_error",
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(
        (e) => `${e.path.join(".")}: ${e.message}`,
      );
      throw new Error(
        `Environment validation failed: ${errorMessages.join(", ")}`,
      );
    }

    throw error;
  }
}

/**
 * Validate Cloudflare Workers bindings
 * @param env Cloudflare environment bindings
 * @returns Validated bindings
 * @throws Error if validation fails
 */
export function validateCloudflareBindings(
  env: Record<string, unknown>,
): CloudflareBindings {
  try {
    const validated = CloudflareBindingsSchema.parse(env);

    logger.info("Cloudflare bindings validation successful", {
      operation: "cf_bindings_validation",
      hasDB: !!validated.DB,
      hasKV: !!validated.OPEN_METEO_CACHE,
    });

    return validated;
  } catch (error) {
    logger.error("Cloudflare bindings validation failed", {
      operation: "cf_bindings_validation_error",
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(
        (e) => `${e.path.join(".")}: ${e.message}`,
      );
      throw new Error(
        `Cloudflare bindings validation failed: ${errorMessages.join(", ")}`,
      );
    }

    throw error;
  }
}

/**
 * Get validated environment configuration for Node.js runtime
 */
export function getValidatedEnvironment(): Environment {
  return validateEnvironment(process.env);
}

/**
 * Validate environment during application startup
 * This should be called early in the application lifecycle
 */
export function validateEnvironmentOnStartup(): void {
  try {
    const env = getValidatedEnvironment();

    // Additional startup validation
    if (env.NODE_ENV === "production" && !env.BATCH_SECRET) {
      throw new Error("BATCH_SECRET is required in production environment");
    }

    logger.info("Application environment validation complete", {
      operation: "startup_validation",
      environment: env.NODE_ENV,
      configuredFeatures: {
        batchOperations: !!env.BATCH_SECRET,
        customBatchStartDate: !!env.BATCH_START_DATE,
      },
    });
  } catch (error) {
    logger.error("Startup environment validation failed", {
      operation: "startup_validation_error",
      error: error instanceof Error ? error.message : String(error),
    });

    // Exit the process on validation failure
    process.exit(1);
  }
}
