import type { Context, Next } from "hono";
import { HTTP_STATUS } from "../../constants/httpStatus";

interface AuthEnv {
  BATCH_SECRET?: string;
  AUTH_MAX_TIME_SKEW_SECONDS?: string;
}

/**
 * Verify HMAC signature for batch authentication
 */
async function verifyHmacSignature(
  signature: string,
  secret: string,
  timestamp: string,
): Promise<boolean> {
  try {
    // Create HMAC using Web Crypto API (available in Bun and Cloudflare Workers)
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);

    // Import the secret as a CryptoKey
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    // Create signature from timestamp
    const data = encoder.encode(timestamp);
    const expectedSignature = await crypto.subtle.sign("HMAC", key, data);

    const expectedBytes = new Uint8Array(expectedSignature);
    const providedBytes = decodeSignature(signature);

    if (!providedBytes || providedBytes.length !== expectedBytes.length) {
      return false;
    }

    // Constant-time comparison to prevent timing attacks
    let result = 0;
    for (let i = 0; i < providedBytes.length; i++) {
      result |= providedBytes[i] ^ expectedBytes[i];
    }
    return result === 0;
  } catch (error) {
    console.error("HMAC verification failed:", error);
    return false;
  }
}

function decodeSignature(signature: string): Uint8Array | null {
  const normalized = signature.trim();

  // Hex signature
  if (/^[0-9a-fA-F]+$/.test(normalized) && normalized.length % 2 === 0) {
    const out = new Uint8Array(normalized.length / 2);
    for (let i = 0; i < normalized.length; i += 2) {
      out[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16);
    }
    return out;
  }

  // Base64 signature
  try {
    const cleaned = normalized.replace(/-/g, "+").replace(/_/g, "/");
    const padded = cleaned.padEnd(Math.ceil(cleaned.length / 4) * 4, "=");
    const decoded = atob(padded);
    return new Uint8Array(Array.from(decoded, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

function getMaxTimeSkewMs(c: Context): number {
  const env = c.env as AuthEnv | undefined;
  const raw =
    env?.AUTH_MAX_TIME_SKEW_SECONDS ??
    globalThis.process?.env?.AUTH_MAX_TIME_SKEW_SECONDS ??
    "300";
  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 5 * 60 * 1000;
  }
  return parsed * 1000;
}

function shouldSkipAuthInDevelopment(): boolean {
  const nodeEnv = globalThis.process?.env?.NODE_ENV;
  const skipAuth = globalThis.process?.env?.SKIP_AUTH;
  return nodeEnv === "development" && skipAuth === "true";
}

/**
 * Authentication middleware for batch endpoints
 */
export async function authMiddleware(c: Context, next: Next) {
  // Allow bypass only if explicitly enabled in local development.
  if (shouldSkipAuthInDevelopment()) {
    return next();
  }

  const authHeader = c.req.header("X-Touring-Auth");
  const timestamp = c.req.header("X-Timestamp");

  if (!authHeader || !timestamp) {
    return c.json(
      { error: "Unauthorized", message: "Missing authentication headers" },
      HTTP_STATUS.UNAUTHORIZED,
    );
  }

  const requestTime = new Date(timestamp);
  const timeDiffMs = Math.abs(Date.now() - requestTime.getTime());
  const maxSkewMs = getMaxTimeSkewMs(c);

  if (Number.isNaN(requestTime.getTime()) || timeDiffMs > maxSkewMs) {
    return c.json(
      { error: "Forbidden", message: "Invalid or expired timestamp" },
      HTTP_STATUS.FORBIDDEN,
    );
  }

  const env = c.env as AuthEnv | undefined;
  const secret = env?.BATCH_SECRET ?? globalThis.process?.env?.BATCH_SECRET;
  if (!secret) {
    console.error("BATCH_SECRET environment variable not set");
    return c.json(
      { error: "Internal Server Error", message: "Server configuration error" },
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }

  const valid = await verifyHmacSignature(authHeader, secret, timestamp);
  if (!valid) {
    return c.json(
      { error: "Forbidden", message: "Invalid authentication signature" },
      HTTP_STATUS.FORBIDDEN,
    );
  }

  return next();
}
