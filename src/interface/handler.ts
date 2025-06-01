import { Context } from 'hono'
import { weatherRepository } from '../di/container'
import { calculateTouringIndex } from '../usecase/CalculateTouringIndex'

export const getTouringIndex = async (c: Context) => {
  const lat = Number(c.req.query('lat'))
  const lon = Number(c.req.query('lon'))
  const datetime = c.req.query('datetime') || new Date().toISOString()

  if (isNaN(lat) || isNaN(lon)) {
    return c.json({ error: 'lat, lon are required and must be numbers' }, 400)
  }

  try {
    const weather = await weatherRepository.getWeather(lat, lon, datetime)
    const { score, breakdown } = calculateTouringIndex(weather)

    return c.json({
      location: { lat, lon },
      datetime,
      score,
      factors: breakdown,
      summary: touringSummary(score),
    })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
}

function touringSummary(score: number): string {
  if (score >= 90) return 'Excellent touring conditions!'
  if (score >= 70) return 'Good conditions, enjoy your ride!'
  if (score >= 50) return 'Somewhat okay, but not ideal.'
  if (score >= 30) return 'Hmm, not great for touring.'
  return 'Poor conditions, better to avoid riding.'
}
