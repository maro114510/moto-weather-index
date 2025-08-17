import type { Context, Next } from "hono";
import { validateEnvironment } from "../../config/environmentValidation";
import { HTTP_STATUS } from "../../constants/httpStatus";

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

    // Convert expected signature to hex string
    const expectedHex = Array.from(new Uint8Array(expectedSignature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Compare signatures using constant-time comparison
    const normalizedSignature = signature.toLowerCase();
    const normalizedExpected = expectedHex.toLowerCase();

    if (normalizedSignature.length !== normalizedExpected.length) {
      return false;
    }

    // Constant-time comparison to prevent timing attacks
    let result = 0;
    for (let i = 0; i < normalizedSignature.length; i++) {
      result |=
        normalizedSignature.charCodeAt(i) ^ normalizedExpected.charCodeAt(i);
    }
    return result === 0;
  } catch (error) {
    console.error("HMAC verification failed:", error);
    return false;
  }
}

/**
 * Authentication middleware for batch endpoints
 */
export async function authMiddleware(c: Context, next: Next) {
  // Validate environment configuration
  let env: ReturnType<typeof validateEnvironment>;
  try {
    env = validateEnvironment(process.env);
  } catch (error) {
    console.error("Environment validation failed in auth middleware:", error);
    return c.json(
      { error: "Internal Server Error", message: "Server configuration error" },
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }

  // Skip authentication in development mode
  if (env.NODE_ENV === "development") {
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

  if (!env.BATCH_SECRET) {
    console.error("BATCH_SECRET environment variable not set");
    return c.json(
      { error: "Internal Server Error", message: "Server configuration error" },
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }

  const valid = await verifyHmacSignature(
    authHeader,
    env.BATCH_SECRET,
    timestamp,
  );
  if (!valid) {
    return c.json(
      { error: "Forbidden", message: "Invalid authentication signature" },
      HTTP_STATUS.FORBIDDEN,
    );
  }

  return next();
}
