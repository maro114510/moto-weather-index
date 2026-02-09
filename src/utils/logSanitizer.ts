const SENSITIVE_KEY_PATTERN =
  /(password|secret|token|authorization|api[_-]?key|cookie|signature|xtouringauth|x[_-]?touring[_-]?auth)/i;

const QUERY_SENSITIVE_PATTERN =
  /([?&])(password|secret|token|authorization|api[_-]?key|signature)=([^&]*)/gi;

export function sanitizeLogData<T>(value: T): T {
  return sanitize(value, new WeakSet()) as T;
}

function sanitize(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") {
    return value.replace(QUERY_SENSITIVE_PATTERN, "$1$2=***");
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, seen));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }
  seen.add(value);

  const out: Record<string, unknown> = {};
  for (const [key, innerValue] of Object.entries(
    value as Record<string, unknown>,
  )) {
    const normalizedKey = key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    if (SENSITIVE_KEY_PATTERN.test(normalizedKey)) {
      out[key] = "***";
      continue;
    }
    out[key] = sanitize(innerValue, seen);
  }
  return out;
}
