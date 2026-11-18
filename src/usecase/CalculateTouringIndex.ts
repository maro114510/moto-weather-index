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

export type MissingTouringIndexFactor = "visibility" | "airQuality";

export type CompleteTouringIndex = {
  score: number;
  breakdown: Record<string, number>;
};

export type IncompleteTouringIndex = {
  missingFactors: MissingTouringIndexFactor[];
};

export type TouringIndexResult = CompleteTouringIndex | IncompleteTouringIndex;

export function calculateTouringIndex(weather: Weather): TouringIndexResult {
  const { airQuality, visibility } = weather;

  // Narrow both optional observations before any score rule runs.
  if (visibility === undefined || airQuality === undefined) {
    const missingFactors: MissingTouringIndexFactor[] = [];
    if (visibility === undefined) missingFactors.push("visibility");
    if (airQuality === undefined) missingFactors.push("airQuality");
    return { missingFactors };
  }

  const breakdown = {
    weather: weatherScore(weather.condition),
    temperature: temperatureScore(weather.temperature),
    wind: windScore(weather.windSpeed),
    humidity: humidityScore(weather.humidity),
    visibility: visibilityScore(visibility),
    precipitationProbability: precipitationProbabilityScore(
      weather.precipitationProbability,
    ),
    uvIndex: uvIndexScore(weather.uvIndex),
    airQuality: airQualityScore(airQuality),
  };
  const score = calculateTouringScore(breakdown as TouringScoreFactors);
  return { score, breakdown };
}
