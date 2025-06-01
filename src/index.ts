import { Hono } from 'hono'
import { getTouringIndex } from './interface/handler'

const app = new Hono()

app.get('/touring-index', getTouringIndex)

export default app
