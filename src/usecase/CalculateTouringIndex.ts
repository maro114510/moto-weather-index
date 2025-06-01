import { Weather } from '../domain/Weather'
import {
  weatherScore,
  temperatureScore,
  windScore,
  humidityScore,
  visibilityScore,
  precipitationProbabilityScore,
  uvIndexScore,
  airQualityScore,
} from '../domain/ScoreRules'
import { TouringScore } from '../domain/TouringScore'

export function calculateTouringIndex(weather: Weather): { score: number, breakdown: Record<string, number> } {
  const breakdown = {
    weather: weatherScore(weather.condition),
    temperature: temperatureScore(weather.temperature),
    wind: windScore(weather.windSpeed),
    humidity: humidityScore(weather.humidity),
    visibility: visibilityScore(weather.visibility),
    precipitationProbability: precipitationProbabilityScore(weather.precipitationProbability),
    uvIndex: uvIndexScore(weather.uvIndex),
    airQuality: airQualityScore(undefined), // TODO: pm25
  }
  const score = TouringScore.calculate(breakdown)
  return { score, breakdown }
}
