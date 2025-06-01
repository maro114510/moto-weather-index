import { Context } from "hono";

export function healthCheck(c: Context) {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
}
