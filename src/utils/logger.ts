import { HTTP_STATUS } from "../constants/httpStatus";
import {
  CONTEXT_FIELDS,
  OPERATIONS,
  type PERFORMANCE_THRESHOLDS,
  buildErrorContext,
  buildPerformanceContext,
} from "../constants/logging";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogContext {
  requestId?: string;
  userId?: string;
  operation?: string;
  location?: {
    lat: number;
    lon: number;
  };
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    cause?: any;
  };
}

class Logger {
  private currentLogLevel: LogLevel = LogLevel.INFO;

  constructor() {
    // Set log level based on environment
    const envLogLevel = globalThis.process?.env?.LOG_LEVEL || "INFO";
    this.setLogLevel(envLogLevel);
  }

  setLogLevel(level: string | LogLevel) {
    if (typeof level === "string") {
      this.currentLogLevel =
        LogLevel[level.toUpperCase() as keyof typeof LogLevel] ?? LogLevel.INFO;
    } else {
      this.currentLogLevel = level;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.currentLogLevel;
  }

  private formatLog(
    level: LogLevel,
    message: string,
    context: LogContext = {},
    error?: Error,
  ): LogEntry {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      context: {
        ...context,
        // Add environment info if available
        ...(globalThis.process?.env?.NODE_ENV && {
          environment: globalThis.process.env.NODE_ENV,
        }),
      },
    };

    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause,
      };
    }

    return logEntry;
  }

  private output(logEntry: LogEntry) {
    const logString = JSON.stringify(logEntry);

    switch (LogLevel[logEntry.level as keyof typeof LogLevel]) {
      case LogLevel.ERROR:
        console.error(logString);
        break;
      case LogLevel.WARN:
        console.warn(logString);
        break;
      case LogLevel.INFO:
        console.info(logString);
        break;
      default:
        console.log(logString);
        break;
    }
  }

  debug(message: string, context: LogContext = {}) {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    this.output(this.formatLog(LogLevel.DEBUG, message, context));
  }

  info(message: string, context: LogContext = {}) {
    if (!this.shouldLog(LogLevel.INFO)) return;
    this.output(this.formatLog(LogLevel.INFO, message, context));
  }

  warn(message: string, context: LogContext = {}, error?: Error) {
    if (!this.shouldLog(LogLevel.WARN)) return;
    this.output(this.formatLog(LogLevel.WARN, message, context, error));
  }

  error(message: string, context: LogContext = {}, error?: Error) {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    this.output(this.formatLog(LogLevel.ERROR, message, context, error));
  }

  // Convenience methods for common scenarios
  apiRequest(method: string, path: string, context: LogContext = {}) {
    this.info(`API Request: ${method} ${path}`, {
      ...context,
      operation: "api_request",
      method,
      path,
    });
  }

  apiResponse(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context: LogContext = {},
  ) {
    const level =
      statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR
        ? LogLevel.ERROR
        : statusCode >= HTTP_STATUS.BAD_REQUEST
          ? LogLevel.WARN
          : LogLevel.INFO;
    const message = `API Response: ${method} ${path} - ${statusCode} (${duration}ms)`;

    if (level === LogLevel.ERROR) {
      this.error(message, {
        ...context,
        operation: "api_response",
        method,
        path,
        statusCode,
        duration,
      });
    } else if (level === LogLevel.WARN) {
      this.warn(message, {
        ...context,
        operation: "api_response",
        method,
        path,
        statusCode,
        duration,
      });
    } else {
      this.info(message, {
        ...context,
        operation: "api_response",
        method,
        path,
        statusCode,
        duration,
      });
    }
  }

  externalApiCall(service: string, endpoint: string, context: LogContext = {}) {
    this.info(`External API Call: ${service} ${endpoint}`, {
      ...context,
      operation: "external_api_call",
      service,
      endpoint,
    });
  }

  externalApiResponse(
    service: string,
    endpoint: string,
    statusCode: number,
    duration: number,
    context: LogContext = {},
  ) {
    const level =
      statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR
        ? LogLevel.ERROR
        : statusCode >= HTTP_STATUS.BAD_REQUEST
          ? LogLevel.WARN
          : LogLevel.INFO;
    const message = `External API Response: ${service} ${endpoint} - ${statusCode} (${duration}ms)`;

    if (level === LogLevel.ERROR) {
      this.error(message, {
        ...context,
        operation: "external_api_response",
        service,
        endpoint,
        statusCode,
        duration,
      });
    } else if (level === LogLevel.WARN) {
      this.warn(message, {
        ...context,
        operation: "external_api_response",
        service,
        endpoint,
        statusCode,
        duration,
      });
    } else {
      this.info(message, {
        ...context,
        operation: "external_api_response",
        service,
        endpoint,
        statusCode,
        duration,
      });
    }
  }

  dbOperation(operation: string, table?: string, context: LogContext = {}) {
    this.debug(
      `Database Operation: ${operation}${table ? ` on ${table}` : ""}`,
      {
        ...context,
        operation: "db_operation",
        dbOperation: operation,
        table,
      },
    );
  }

  cacheOperation(
    operation: string,
    key: string,
    hit: boolean,
    context: LogContext = {},
  ) {
    this.debug(`Cache ${operation}: ${key} - ${hit ? "HIT" : "MISS"}`, {
      ...context,
      operation: "cache_operation",
      cacheOperation: operation,
      key,
      hit,
    });
  }

  businessLogic(operation: string, context: LogContext = {}) {
    this.debug(`Business Logic: ${operation}`, {
      ...context,
      operation: "business_logic",
      businessOperation: operation,
    });
  }

  // Enhanced standardized logging methods using constants

  /**
   * Log database operation with performance tracking
   */
  dbOperationWithTiming(
    operation: string,
    table: string,
    startTime: number,
    context: LogContext = {},
  ) {
    const performanceContext = buildPerformanceContext(startTime, "DB_NORMAL", {
      ...context,
      [CONTEXT_FIELDS.OPERATION]: OPERATIONS.DB_QUERY,
      dbOperation: operation,
      table,
    });

    this.debug(
      `Database Operation: ${operation} on ${table}`,
      performanceContext,
    );
  }

  /**
   * Log external API call with performance tracking
   */
  externalApiCallWithTiming(
    service: string,
    endpoint: string,
    startTime: number,
    statusCode: number,
    context: LogContext = {},
  ) {
    const performanceContext = buildPerformanceContext(
      startTime,
      "EXTERNAL_API_NORMAL",
      {
        ...context,
        [CONTEXT_FIELDS.OPERATION]: OPERATIONS.EXTERNAL_API_RESPONSE,
        service,
        endpoint,
        [CONTEXT_FIELDS.STATUS_CODE]: statusCode,
      },
    );

    const level =
      statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR
        ? LogLevel.ERROR
        : statusCode >= HTTP_STATUS.BAD_REQUEST
          ? LogLevel.WARN
          : LogLevel.INFO;

    const message = `External API: ${service} ${endpoint} - ${statusCode} (${performanceContext.duration}ms)`;

    if (level === LogLevel.ERROR) {
      this.error(message, performanceContext);
    } else if (level === LogLevel.WARN) {
      this.warn(message, performanceContext);
    } else {
      this.info(message, performanceContext);
    }
  }

  /**
   * Log business logic operation with performance tracking
   */
  businessLogicWithTiming(
    operation: string,
    startTime: number,
    success: boolean,
    context: LogContext = {},
  ) {
    const performanceContext = buildPerformanceContext(
      startTime,
      "BUSINESS_LOGIC_NORMAL",
      {
        ...context,
        [CONTEXT_FIELDS.OPERATION]: success
          ? OPERATIONS.BUSINESS_LOGIC_SUCCESS
          : OPERATIONS.BUSINESS_LOGIC_ERROR,
        businessOperation: operation,
        success,
      },
    );

    const message = `Business Logic: ${operation} - ${success ? "SUCCESS" : "FAILED"} (${performanceContext.duration}ms)`;

    if (success) {
      this.info(message, performanceContext);
    } else {
      this.error(message, performanceContext);
    }
  }

  /**
   * Log standardized error with enhanced context
   */
  errorWithContext(
    message: string,
    error: unknown,
    baseContext: LogContext = {},
  ) {
    const errorContext = buildErrorContext(error, {
      ...baseContext,
      [CONTEXT_FIELDS.OPERATION]: OPERATIONS.BUSINESS_LOGIC_ERROR,
    });

    this.error(
      message,
      errorContext,
      error instanceof Error ? error : undefined,
    );
  }

  /**
   * Log batch operation progress
   */
  batchOperation(
    operation: string,
    processed: number,
    total: number,
    context: LogContext = {},
  ) {
    const progressPercent =
      total > 0 ? Math.round((processed / total) * 100) : 0;

    this.info(
      `Batch Operation: ${operation} - ${processed}/${total} (${progressPercent}%)`,
      {
        ...context,
        [CONTEXT_FIELDS.OPERATION]: OPERATIONS.BATCH_PROCESSING,
        batchOperation: operation,
        processed,
        total,
        progressPercent,
      },
    );
  }
}

// Export singleton instance
export const logger = new Logger();

// Export utility functions for creating context
export function createRequestContext(
  requestId: string,
  additional: Partial<LogContext> = {},
): LogContext {
  return {
    requestId,
    ...additional,
  };
}

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
