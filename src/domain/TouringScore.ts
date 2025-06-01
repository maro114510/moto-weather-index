export interface TouringScoreFactors {
  weather: number
  temperature: number
  wind: number
  humidity: number
  visibility: number
  precipitationProbability: number
  uvIndex: number
  airQuality: number
}

export class TouringScore {
  static maxScore = 100

  static calculate(f: TouringScoreFactors): number {
    let score =
    f.weather +
    f.temperature +
    f.wind +
    f.humidity +
    f.visibility +
    f.precipitationProbability +
    f.uvIndex +
    f.airQuality

    // Min and max bounds
    return Math.max(0, Math.min(TouringScore.maxScore, Math.round(score)))
  }
}
