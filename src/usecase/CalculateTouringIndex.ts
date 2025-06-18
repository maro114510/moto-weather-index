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
  type TouringScoreFactors,
  calculateTouringScore,
} from "../domain/TouringScore";
import type { Weather } from "../domain/Weather";
import type { TouringIndexResult } from "../types/api";

export function calculateTouringIndex(weather: Weather): TouringIndexResult {
  const breakdown: TouringScoreFactors = {
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
  const score = calculateTouringScore(breakdown);
  return { score, breakdown };
}
