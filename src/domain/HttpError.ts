import type { ErrorCode } from "../constants/errorCodes";

export interface HttpErrorOptions {
  code?: ErrorCode;
  details?: Record<string, unknown>;
  cause?: unknown;
}

export class HttpError extends Error {
  readonly status: number;
  readonly code?: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(status: number, message: string, options: HttpErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = "HttpError";
    this.status = status;
    this.code = options.code;
    this.details = options.details;
  }
}
