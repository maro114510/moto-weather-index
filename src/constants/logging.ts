// src/constants/logging.ts

/**
 * Standard operation names for consistent logging across the application
 */
export const OPERATIONS = {
  // API Operations
  API_REQUEST: "api_request",
  API_RESPONSE: "api_response",
  API_ERROR: "api_error",

  // External API Operations
  EXTERNAL_API_CALL: "external_api_call",
  EXTERNAL_API_RESPONSE: "external_api_response",
  EXTERNAL_API_ERROR: "external_api_error",

  // Database Operations
  DB_QUERY: "db_query",
  DB_INSERT: "db_insert",
  DB_UPDATE: "db_update",
  DB_DELETE: "db_delete",
  DB_UPSERT: "db_upsert",
  DB_ERROR: "db_error",

  // Cache Operations
  CACHE_GET: "cache_get",
  CACHE_SET: "cache_set",
  CACHE_HIT: "cache_hit",
  CACHE_MISS: "cache_miss",
  CACHE_ERROR: "cache_error",

  // Business Logic Operations
  BUSINESS_LOGIC_START: "business_logic_start",
  BUSINESS_LOGIC_SUCCESS: "business_logic_success",
  BUSINESS_LOGIC_ERROR: "business_logic_error",

  // Batch Processing Operations
  BATCH_START: "batch_start",
  BATCH_PROCESSING: "batch_processing",
  BATCH_SUCCESS: "batch_success",
  BATCH_ERROR: "batch_error",
  BATCH_RETRY: "batch_retry",

  // Weather Operations
  WEATHER_FETCH: "weather_fetch",
  WEATHER_FETCH_SUCCESS: "weather_fetch_success",
  WEATHER_FETCH_ERROR: "weather_fetch_error",

  // Touring Index Operations
  TOURING_INDEX_CALCULATE: "touring_index_calculate",
  TOURING_INDEX_SUCCESS: "touring_index_success",
  TOURING_INDEX_ERROR: "touring_index_error",

  // Validation Operations
  VALIDATION_START: "validation_start",
  VALIDATION_SUCCESS: "validation_success",
  VALIDATION_ERROR: "validation_error",

  // System Operations
  SYSTEM_INIT: "system_init",
  SYSTEM_ERROR: "system_error",
  HEALTH_CHECK: "health_check",
} as const;

/**
 * Standard performance thresholds for different operation types (in milliseconds)
 */
export const PERFORMANCE_THRESHOLDS = {
  // API Response Times
  API_FAST: 100,
  API_NORMAL: 500,
  API_SLOW: 2000,

  // Database Query Times
  DB_FAST: 50,
  DB_NORMAL: 200,
  DB_SLOW: 1000,

  // External API Times
  EXTERNAL_API_FAST: 200,
  EXTERNAL_API_NORMAL: 1000,
  EXTERNAL_API_SLOW: 5000,

  // Cache Operations
  CACHE_FAST: 10,
  CACHE_NORMAL: 50,
  CACHE_SLOW: 200,

  // Business Logic
  BUSINESS_LOGIC_FAST: 100,
  BUSINESS_LOGIC_NORMAL: 1000,
  BUSINESS_LOGIC_SLOW: 5000,
} as const;

/**
 * Standard context field names for consistent logging
 */
export const CONTEXT_FIELDS = {
  // Request Context
  REQUEST_ID: "requestId",
  USER_ID: "userId",
  SESSION_ID: "sessionId",

  // Location Context
  LOCATION: "location",
  LATITUDE: "lat",
  LONGITUDE: "lon",

  // Time Context
  START_TIME: "startTime",
  END_TIME: "endTime",
  DURATION: "duration",
  DATETIME: "datetime",

  // Operation Context
  OPERATION: "operation",
  OPERATION_TYPE: "operationType",

  // Data Context
  PREFECTURE_ID: "prefecture_id",
  PREFECTURE_NAME: "prefecture_name",
  SCORE: "score",
  WEATHER_CONDITION: "weatherCondition",
  TEMPERATURE: "temperature",

  // Error Context
  ERROR_TYPE: "errorType",
  ERROR_MESSAGE: "errorMessage",
  ERROR_CODE: "errorCode",
  STATUS_CODE: "statusCode",

  // Performance Context
  PERFORMANCE_LEVEL: "performanceLevel",
  CACHE_HIT: "cacheHit",
  RECORDS_COUNT: "recordsCount",
  PROCESSING_COUNT: "processingCount",
} as const;

/**
 * Get performance level based on duration and thresholds
 */
export function getPerformanceLevel(
  duration: number,
  operationType: keyof typeof PERFORMANCE_THRESHOLDS,
): "fast" | "normal" | "slow" {
  const thresholds = PERFORMANCE_THRESHOLDS[operationType];
  if (typeof thresholds === "object") {
    // For complex thresholds, use the normal threshold
    const normalThreshold = (thresholds as any).NORMAL || 1000;
    const _slowThreshold = (thresholds as any).SLOW || 5000;

    if (duration <= normalThreshold / 2) return "fast";
    if (duration <= normalThreshold) return "normal";
    return "slow";
  }

  // Simple threshold
  if (duration <= thresholds / 2) return "fast";
  if (duration <= thresholds) return "normal";
  return "slow";
}

/**
 * Standard error context builder
 */
export function buildErrorContext(
  error: unknown,
  baseContext: Record<string, any> = {},
): Record<string, any> {
  const errorContext = { ...baseContext };

  if (error instanceof Error) {
    errorContext[CONTEXT_FIELDS.ERROR_TYPE] = error.constructor.name;
    errorContext[CONTEXT_FIELDS.ERROR_MESSAGE] = error.message;

    // Add stack trace for debug level
    if (error.stack) {
      errorContext.stack = error.stack;
    }
  } else {
    errorContext[CONTEXT_FIELDS.ERROR_TYPE] = typeof error;
    errorContext[CONTEXT_FIELDS.ERROR_MESSAGE] = String(error);
  }

  return errorContext;
}

/**
 * Standard performance context builder
 */
export function buildPerformanceContext(
  startTime: number,
  operationType: keyof typeof PERFORMANCE_THRESHOLDS,
  baseContext: Record<string, any> = {},
): Record<string, any> {
  const duration = Date.now() - startTime;
  const performanceLevel = getPerformanceLevel(duration, operationType);

  return {
    ...baseContext,
    [CONTEXT_FIELDS.DURATION]: duration,
    [CONTEXT_FIELDS.PERFORMANCE_LEVEL]: performanceLevel,
  };
}
