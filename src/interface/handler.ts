import { Context } from 'hono'

export const getTouringIndex = (c: Context) => {
  return c.json({ message: 'Touring Index API is under construction!' })
}
