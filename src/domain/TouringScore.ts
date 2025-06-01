import { z } from "zod";

/**
 * Zod schema for individual factor scores used in Touring Comfort Index calculation.
 * Each factor must be a finite, non-negative number within a reasonable domain.
 */
export const TouringScoreFactorsSchema = z.object({
  weather: z.number().min(0).max(30),                 // Weather score: 0–30
  temperature: z.number().min(0).max(20),             // Temperature score: 0–20
  wind: z.number().min(0).max(15),                    // Wind score: 0–15
  humidity: z.number().min(0).max(10),                // Humidity score: 0–10
  visibility: z.number().min(0).max(5),               // Visibility score: 0–5
  precipitationProbability: z.number().min(0).max(10),// Precipitation probability score: 0–10
  uvIndex: z.number().min(0).max(5),                  // UV index score: 0–5
  airQuality: z.number().min(0).max(5),               // Air quality score: 0–5
});
export type TouringScoreFactors = z.infer<typeof TouringScoreFactorsSchema>;

/**
 * Class to calculate the Touring Comfort Index from all factor subscores.
 * Ensures input validation via Zod schema before calculation.
 */
export class TouringScore {
  static maxScore = 100;

  /**
   * Calculates the total comfort index score.
   * All subscores are validated for range/consistency.
   * Returns an integer score, bounded 0–100.
   * @param f - Object with all factor scores (already validated)
   * @returns Rounded total score (0–100)
   * @throws ZodError if any factor is out of expected range
   */
  static calculate(f: TouringScoreFactors): number {
    // Validate all input values strictly via zod
    TouringScoreFactorsSchema.parse(f);

    let score =
      f.weather +
      f.temperature +
      f.wind +
      f.humidity +
      f.visibility +
      f.precipitationProbability +
      f.uvIndex +
      f.airQuality;

    // Enforce min and max bounds (0–100)
    return Math.max(0, Math.min(TouringScore.maxScore, Math.round(score)));
  }
}
