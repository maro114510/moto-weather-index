import stringify from "safe-stable-stringify";

const REDACTED = "***";
const SENSITIVE_KEY_PATTERN =
  /(password|secret|token|authorization|api[_-]?key|cookie|signature|xtouringauth|x[_-]?touring[_-]?auth)/i;
const SENSITIVE_ASSIGNMENT_PATTERN =
  /(\b(?:password|secret|token|authorization|api[_-]?key|cookie|signature|xtouringauth|x[_-]?touring[_-]?auth)\b\s*[:=]\s*)([^\s&,;"']+)/gi;
const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;

function normalizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function sanitizeString(value: string): string {
  return value
    .replace(
      SENSITIVE_ASSIGNMENT_PATTERN,
      (match: string, prefix: string, sensitiveValue: string) =>
        sensitiveValue.toLowerCase() === "bearer" ? match : `${prefix}***`,
    )
    .replace(BEARER_TOKEN_PATTERN, "Bearer ***");
}

export function sanitizeLogData<T>(value: T): T {
  const serialized = stringify(value, (key, innerValue) => {
    if (
      key &&
      SENSITIVE_KEY_PATTERN.test(normalizeKey(key)) &&
      innerValue !== undefined
    ) {
      return REDACTED;
    }

    if (typeof innerValue === "string") {
      return sanitizeString(innerValue);
    }

    return innerValue;
  });

  if (serialized === undefined) {
    return value;
  }

  return JSON.parse(serialized) as T;
}
