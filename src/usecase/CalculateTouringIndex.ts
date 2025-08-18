import {
  airQualityScore,
  humidityScore,
  precipitationProbabilityScore,
  temperatureScore,
  uvIndexScore,
  visibilityScore,
  weatherScore,
  windScore,
} from "../domain/ScoreRules";
import {
  calculateTouringScore,
  type TouringScoreFactors,
} from "../domain/TouringScore";
import type { Weather } from "../domain/Weather";

export function calculateTouringIndex(weather: Weather): {
  score: number;
  breakdown: Record<string, number>;
} {
  const breakdown = {
    weather: weatherScore(weather.condition),
    temperature: temperatureScore(weather.temperature),
    wind: windScore(weather.windSpeed),
    humidity: humidityScore(weather.humidity),
    visibility: visibilityScore(weather.visibility),
    precipitationProbability: precipitationProbabilityScore(
      weather.precipitationProbability,
    ),
    uvIndex: uvIndexScore(weather.uvIndex),
    airQuality: airQualityScore(weather.airQuality),
  };
  const score = calculateTouringScore(breakdown as TouringScoreFactors);
  return { score, breakdown };
}
