import { cors } from "hono/cors";

const ALLOWED_ORIGINS = [
  "https://moto-weather-index-front.pages.dev",
  "https://moto-weather-index-front.vercel.app",
  "https://moto-weather-index.page.stelzen.dev",
  "http://localhost:3000",
];

export const corsMiddleware = cors({
  origin: ALLOWED_ORIGINS,
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type"],
  maxAge: 86400,
});
