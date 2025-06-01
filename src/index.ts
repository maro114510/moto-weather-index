import { Hono } from 'hono';
import { getTouringIndex } from './interface/handler';

const app = new Hono();

app.get('/weather', getTouringIndex);

if (import.meta.main) {
  Bun.serve({
    fetch: app.fetch,
    port: 3000,
  })
  console.log('🚀 Touring Weather API running at http://localhost:3000')
}
