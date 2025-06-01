import { app } from "./interface/router";
import { serve } from '@hono/node-server';

const port = process.env.PORT || 3000;

serve({
  fetch: app.fetch,
  port: port as number,
});

console.log("Server is running on http://localhost:" + port);
