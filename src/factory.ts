import { createFactory } from "hono/factory";
import type { AppEnv } from "./types/env";

export const factory = createFactory<AppEnv>();
