import { describe, expect, test } from "bun:test";
import { ZodError } from "zod";
import {
  type AirQualityLevel,
  type Weather,
  type WeatherCondition,
  createWeather,
} from "../domain/Weather";
import { calculateTouringIndex } from "./CalculateTouringIndex";

describe("CalculateTouringIndex", () => {
  describe("Normal Cases - Valid Weather Data", () => {
    describe("Perfect Conditions", () => {
      test("should return maximum score for perfect touring conditions", () => {
        const perfectWeather: Weather = {
          datetime: "2025-06-01T12:00:00Z",
          condition: "clear" as WeatherCondition,
          temperature: 21.5, // Ideal temperature
          windSpeed: 2.5, // Ideal wind
          humidity: 50, // Ideal humidity
          visibility: 20, // Excellent visibility
          precipitationProbability: 0, // No rain
          uvIndex: 3, // Safe UV
          airQuality: "low" as AirQualityLevel,
        };

        const result = calculateTouringIndex(perfectWeather);

        expect(result.score).toBe(100);
        expect(result.breakdown).toEqual({
          weather: 30,
          temperature: 20,
          wind: 15,
          humidity: 10,
          visibility: 5,
          precipitationProbability: 10,
          uvIndex: 5,
          airQuality: 5,
        });
      });
    });

    describe("Weather Condition Scoring", () => {
      const baseWeather = {
        datetime: "2025-06-01T12:00:00Z",
        temperature: 21.5,
        windSpeed: 2.5,
        humidity: 50,
        visibility: 20,
        precipitationProbability: 0,
        uvIndex: 3,
      };

      test("should score clear weather as 30 points", () => {
        const weather: Weather = { ...baseWeather, condition: "clear" };
        const result = calculateTouringIndex(weather);
        expect(result.breakdown.weather).toBe(30);
      });

      test("should score cloudy weather as 15 points", () => {
        const weather: Weather = { ...baseWeather, condition: "cloudy" };
        const result = calculateTouringIndex(weather);
        expect(result.breakdown.weather).toBe(15);
      });

      test("should score rain weather as 0 points", () => {
        const weather: Weather = { ...baseWeather, condition: "rain" };
        const result = calculateTouringIndex(weather);
        expect(result.breakdown.weather).toBe(0);
      });

      test("should score snow weather as 0 points", () => {
        const weather: Weather = { ...baseWeather, condition: "snow" };
        const result = calculateTouringIndex(weather);
        expect(result.breakdown.weather).toBe(0);
      });

      test("should score unknown weather as 10 points", () => {
        const weather: Weather = { ...baseWeather, condition: "unknown" };
        const result = calculateTouringIndex(weather);
        expect(result.breakdown.weather).toBe(10);
      });
    });

    describe("Temperature Scoring - Boundary Values", () => {
      const baseWeather = {
        datetime: "2025-06-01T12:00:00Z",
        condition: "clear" as WeatherCondition,
        windSpeed: 2.5,
        humidity: 50,
        visibility: 20,
        precipitationProbability: 0,
        uvIndex: 3,
      };

      test("should score ideal temperature (21.5°C) as 20 points", () => {
        const weather: Weather = { ...baseWeather, temperature: 21.5 };
        const result = calculateTouringIndex(weather);
        expect(result.breakdown.temperature).toBe(20);
      });

      test("should score temperature boundaries correctly", () => {
        // Test various temperature boundaries based on new logic: 20 - Math.abs(temp - 21.5)
        const testCases = [
          { temp: -50, expectedScore: 0 }, // Too cold, minimum score
          { temp: -10, expectedScore: 0 }, // Very cold, minimum score
          { temp: 16.5, expectedScore: 15 }, // 5°C below ideal: 20 - 5 = 15
          { temp: 19.5, expectedScore: 18 }, // 2°C below ideal: 20 - 2 = 18
          { temp: 20.5, expectedScore: 19 }, // 1°C below ideal: 20 - 1 = 19
          { temp: 21.0, expectedScore: 20 }, // 0.5°C below ideal: 20 - 0.5 = 19.5, rounded to 20
          { temp: 21.5, expectedScore: 20 }, // Ideal: 20 - 0 = 20
          { temp: 22.0, expectedScore: 20 }, // 0.5°C above ideal: 20 - 0.5 = 19.5, rounded to 20
          { temp: 22.5, expectedScore: 19 }, // 1°C above ideal: 20 - 1 = 19
          { temp: 23.5, expectedScore: 18 }, // 2°C above ideal: 20 - 2 = 18
          { temp: 26.5, expectedScore: 15 }, // 5°C above ideal: 20 - 5 = 15
          { temp: 35, expectedScore: 7 }, // 13.5°C above ideal: 20 - 13.5 = 6.5, rounded to 7
          { temp: 60, expectedScore: 0 }, // Too hot, minimum score
        ];

        testCases.forEach(({ temp, expectedScore }) => {
          const weather: Weather = { ...baseWeather, temperature: temp };
          const result = calculateTouringIndex(weather);
          expect(result.breakdown.temperature).toBe(expectedScore);
        });
      });
    });

    describe("Wind Speed Scoring - Boundary Values", () => {
      const baseWeather = {
        datetime: "2025-06-01T12:00:00Z",
        condition: "clear" as WeatherCondition,
        temperature: 21.5,
        humidity: 50,
        visibility: 20,
        precipitationProbability: 0,
        uvIndex: 3,
      };

      test("should score wind speed boundaries correctly", () => {
        const testCases = [
          { wind: 0, expectedScore: 10 }, // No wind
          { wind: 1, expectedScore: 15 }, // Ideal start
          { wind: 2.5, expectedScore: 15 }, // Ideal middle
          { wind: 4, expectedScore: 15 }, // Ideal end
          { wind: 5, expectedScore: 10 }, // Slightly strong
          { wind: 7, expectedScore: 10 }, // Still acceptable
          { wind: 7.1, expectedScore: 0 }, // Too strong
          { wind: 10, expectedScore: 0 }, // Strong
          { wind: 15, expectedScore: 0 }, // Very strong
          { wind: 100, expectedScore: 0 }, // Maximum allowed (updated from 50)
        ];

        testCases.forEach(({ wind, expectedScore }) => {
          const weather: Weather = { ...baseWeather, windSpeed: wind };
          const result = calculateTouringIndex(weather);
          expect(result.breakdown.wind).toBe(expectedScore);
        });
      });
    });

    describe("Humidity Scoring - Boundary Values", () => {
      const baseWeather = {
        datetime: "2025-06-01T12:00:00Z",
        condition: "clear" as WeatherCondition,
        temperature: 21.5,
        windSpeed: 2.5,
        visibility: 20,
        precipitationProbability: 0,
        uvIndex: 3,
      };

      test("should score humidity boundaries correctly", () => {
        const testCases = [
          { humidity: 0, expectedScore: 0 }, // 10 - 50/5 = 0
          { humidity: 25, expectedScore: 5 }, // 10 - 25/5 = 5
          { humidity: 40, expectedScore: 8 }, // 10 - 10/5 = 8
          { humidity: 45, expectedScore: 9 }, // 10 - 5/5 = 9
          { humidity: 50, expectedScore: 10 }, // 10 - 0/5 = 10
          { humidity: 55, expectedScore: 9 }, // 10 - 5/5 = 9
          { humidity: 60, expectedScore: 8 }, // 10 - 10/5 = 8
          { humidity: 75, expectedScore: 5 }, // 10 - 25/5 = 5
          { humidity: 100, expectedScore: 0 }, // 10 - 50/5 = 0
        ];

        testCases.forEach(({ humidity, expectedScore }) => {
          const weather: Weather = { ...baseWeather, humidity };
          const result = calculateTouringIndex(weather);
          expect(result.breakdown.humidity).toBe(expectedScore);
        });
      });
    });

    describe("Visibility Scoring - Boundary Values", () => {
      const baseWeather = {
        datetime: "2025-06-01T12:00:00Z",
        condition: "clear" as WeatherCondition,
        temperature: 21.5,
        windSpeed: 2.5,
        humidity: 50,
        precipitationProbability: 0,
        uvIndex: 3,
      };

      test("should score visibility boundaries correctly", () => {
        const testCases = [
          { visibility: 0, expectedScore: 0 }, // Poor visibility
          { visibility: 5.9, expectedScore: 0 }, // Just below moderate
          { visibility: 6, expectedScore: 2 }, // Moderate start
          { visibility: 9, expectedScore: 2 }, // Moderate end
          { visibility: 10, expectedScore: 4 }, // Good start
          { visibility: 14, expectedScore: 4 }, // Good end
          { visibility: 15, expectedScore: 5 }, // Best start
          { visibility: 50, expectedScore: 5 }, // Excellent
          { visibility: 100, expectedScore: 5 }, // Maximum
        ];

        testCases.forEach(({ visibility, expectedScore }) => {
          const weather: Weather = { ...baseWeather, visibility };
          const result = calculateTouringIndex(weather);
          expect(result.breakdown.visibility).toBe(expectedScore);
        });
      });
    });

    describe("Precipitation Probability Scoring - Boundary Values", () => {
      const baseWeather = {
        datetime: "2025-06-01T12:00:00Z",
        condition: "clear" as WeatherCondition,
        temperature: 21.5,
        windSpeed: 2.5,
        humidity: 50,
        visibility: 20,
        uvIndex: 3,
      };

      test("should score precipitation probability boundaries correctly", () => {
        const testCases = [
          { prob: 0, expectedScore: 10 }, // No chance
          { prob: 10, expectedScore: 9 }, // 10% chance
          { prob: 30, expectedScore: 7 }, // 30% chance
          { prob: 50, expectedScore: 5 }, // 50% chance
          { prob: 70, expectedScore: 3 }, // 70% chance
          { prob: 90, expectedScore: 1 }, // 90% chance
          { prob: 100, expectedScore: 0 }, // Certain rain
        ];

        testCases.forEach(({ prob, expectedScore }) => {
          const weather: Weather = {
            ...baseWeather,
            precipitationProbability: prob,
          };
          const result = calculateTouringIndex(weather);
          expect(result.breakdown.precipitationProbability).toBe(expectedScore);
        });
      });
    });

    describe("UV Index Scoring - Boundary Values", () => {
      const baseWeather = {
        datetime: "2025-06-01T12:00:00Z",
        condition: "clear" as WeatherCondition,
        temperature: 21.5,
        windSpeed: 2.5,
        humidity: 50,
        visibility: 20,
        precipitationProbability: 0,
      };

      test("should score UV index boundaries correctly", () => {
        const testCases = [
          { uv: 0, expectedScore: 5 }, // Minimum
          { uv: 4, expectedScore: 5 }, // Low UV end
          { uv: 5, expectedScore: 3 }, // Moderate UV start
          { uv: 6, expectedScore: 3 }, // Moderate UV end
          { uv: 7, expectedScore: 0 }, // High UV start
          { uv: 15, expectedScore: 0 }, // Very high UV
          { uv: 20, expectedScore: 0 }, // Maximum
        ];

        testCases.forEach(({ uv, expectedScore }) => {
          const weather: Weather = { ...baseWeather, uvIndex: uv };
          const result = calculateTouringIndex(weather);
          expect(result.breakdown.uvIndex).toBe(expectedScore);
        });
      });
    });

    describe("Air Quality Scoring", () => {
      const baseWeather = {
        datetime: "2025-06-01T12:00:00Z",
        condition: "clear" as WeatherCondition,
        temperature: 21.5,
        windSpeed: 2.5,
        humidity: 50,
        visibility: 20,
        precipitationProbability: 0,
        uvIndex: 3,
      };

      test("should score undefined air quality as 5 points (best case)", () => {
        const weather: Weather = { ...baseWeather };
        const result = calculateTouringIndex(weather);
        expect(result.breakdown.airQuality).toBe(5);
      });

      test("should score low air quality as 5 points", () => {
        const weather: Weather = { ...baseWeather, airQuality: "low" };
        const result = calculateTouringIndex(weather);
        expect(result.breakdown.airQuality).toBe(5);
      });

      test("should score medium air quality as 3 points", () => {
        const weather: Weather = { ...baseWeather, airQuality: "medium" };
        const result = calculateTouringIndex(weather);
        expect(result.breakdown.airQuality).toBe(3);
      });

      test("should score high air quality as 0 points", () => {
        const weather: Weather = { ...baseWeather, airQuality: "high" };
        const result = calculateTouringIndex(weather);
        expect(result.breakdown.airQuality).toBe(0);
      });
    });

    describe("Edge Cases - Worst Conditions", () => {
      test("should return minimum score for worst touring conditions", () => {
        const worstWeather: Weather = {
          datetime: "2025-06-01T12:00:00Z",
          condition: "snow" as WeatherCondition,
          temperature: -50, // Extremely cold
          windSpeed: 50, // Maximum wind
          humidity: 100, // Maximum humidity
          visibility: 0, // No visibility
          precipitationProbability: 100, // Certain precipitation
          uvIndex: 20, // Maximum UV
          airQuality: "high" as AirQualityLevel,
        };

        const result = calculateTouringIndex(worstWeather);

        expect(result.score).toBe(0);
        expect(result.breakdown).toEqual({
          weather: 0,
          temperature: 0,
          wind: 0,
          humidity: 0,
          visibility: 0,
          precipitationProbability: 0,
          uvIndex: 0,
          airQuality: 0,
        });
      });
    });
  });

  describe("Abnormal Cases - Invalid Weather Data", () => {
    describe("Invalid Temperature", () => {
      test("should throw ZodError for temperature below minimum (-50°C)", () => {
        expect(() => {
          const invalidWeather = createWeather({
            datetime: "2025-06-01T12:00:00Z",
            condition: "clear",
            temperature: -51, // Below minimum
            windSpeed: 2.5,
            humidity: 50,
            visibility: 20,
            precipitationProbability: 0,
            uvIndex: 3,
          });
          calculateTouringIndex(invalidWeather);
        }).toThrow(ZodError);
      });

      test("should throw ZodError for temperature above maximum (60°C)", () => {
        expect(() => {
          const invalidWeather = createWeather({
            datetime: "2025-06-01T12:00:00Z",
            condition: "clear",
            temperature: 61, // Above maximum
            windSpeed: 2.5,
            humidity: 50,
            visibility: 20,
            precipitationProbability: 0,
            uvIndex: 3,
          });
          calculateTouringIndex(invalidWeather);
        }).toThrow(ZodError);
      });

      test("should throw ZodError for non-numeric temperature", () => {
        expect(() => {
          createWeather({
            datetime: "2025-06-01T12:00:00Z",
            condition: "clear",
            temperature: "hot", // Non-numeric
            windSpeed: 2.5,
            humidity: 50,
            visibility: 20,
            precipitationProbability: 0,
            uvIndex: 3,
          });
        }).toThrow(ZodError);
      });
    });

    describe("Invalid Wind Speed", () => {
      test("should throw ZodError for negative wind speed", () => {
        expect(() => {
          const invalidWeather = createWeather({
            datetime: "2025-06-01T12:00:00Z",
            condition: "clear",
            temperature: 21.5,
            windSpeed: -1, // Negative
            humidity: 50,
            visibility: 20,
            precipitationProbability: 0,
            uvIndex: 3,
          });
          calculateTouringIndex(invalidWeather);
        }).toThrow(ZodError);
      });

      test("should throw ZodError for wind speed above maximum (100 m/s)", () => {
        expect(() => {
          const invalidWeather = createWeather({
            datetime: "2025-06-01T12:00:00Z",
            condition: "clear",
            temperature: 21.5,
            windSpeed: 101, // Above maximum (updated from 51)
            humidity: 50,
            visibility: 20,
            precipitationProbability: 0,
            uvIndex: 3,
          });
          calculateTouringIndex(invalidWeather);
        }).toThrow(ZodError);
      });
    });

    describe("Invalid Humidity", () => {
      test("should throw ZodError for negative humidity", () => {
        expect(() => {
          const invalidWeather = createWeather({
            datetime: "2025-06-01T12:00:00Z",
            condition: "clear",
            temperature: 21.5,
            windSpeed: 2.5,
            humidity: -1, // Negative
            visibility: 20,
            precipitationProbability: 0,
            uvIndex: 3,
          });
          calculateTouringIndex(invalidWeather);
        }).toThrow(ZodError);
      });

      test("should throw ZodError for humidity above 100%", () => {
        expect(() => {
          const invalidWeather = createWeather({
            datetime: "2025-06-01T12:00:00Z",
            condition: "clear",
            temperature: 21.5,
            windSpeed: 2.5,
            humidity: 101, // Above maximum
            visibility: 20,
            precipitationProbability: 0,
            uvIndex: 3,
          });
          calculateTouringIndex(invalidWeather);
        }).toThrow(ZodError);
      });
    });

    describe("Invalid Visibility", () => {
      test("should throw ZodError for negative visibility", () => {
        expect(() => {
          const invalidWeather = createWeather({
            datetime: "2025-06-01T12:00:00Z",
            condition: "clear",
            temperature: 21.5,
            windSpeed: 2.5,
            humidity: 50,
            visibility: -1, // Negative
            precipitationProbability: 0,
            uvIndex: 3,
          });
          calculateTouringIndex(invalidWeather);
        }).toThrow(ZodError);
      });

      test("should throw ZodError for visibility above maximum (100 km)", () => {
        expect(() => {
          const invalidWeather = createWeather({
            datetime: "2025-06-01T12:00:00Z",
            condition: "clear",
            temperature: 21.5,
            windSpeed: 2.5,
            humidity: 50,
            visibility: 101, // Above maximum
            precipitationProbability: 0,
            uvIndex: 3,
          });
          calculateTouringIndex(invalidWeather);
        }).toThrow(ZodError);
      });
    });

    describe("Invalid Precipitation Probability", () => {
      test("should throw ZodError for negative precipitation probability", () => {
        expect(() => {
          const invalidWeather = createWeather({
            datetime: "2025-06-01T12:00:00Z",
            condition: "clear",
            temperature: 21.5,
            windSpeed: 2.5,
            humidity: 50,
            visibility: 20,
            precipitationProbability: -1, // Negative
            uvIndex: 3,
          });
          calculateTouringIndex(invalidWeather);
        }).toThrow(ZodError);
      });

      test("should throw ZodError for precipitation probability above 100%", () => {
        expect(() => {
          const invalidWeather = createWeather({
            datetime: "2025-06-01T12:00:00Z",
            condition: "clear",
            temperature: 21.5,
            windSpeed: 2.5,
            humidity: 50,
            visibility: 20,
            precipitationProbability: 101, // Above maximum
            uvIndex: 3,
          });
          calculateTouringIndex(invalidWeather);
        }).toThrow(ZodError);
      });
    });

    describe("Invalid UV Index", () => {
      test("should throw ZodError for negative UV index", () => {
        expect(() => {
          const invalidWeather = createWeather({
            datetime: "2025-06-01T12:00:00Z",
            condition: "clear",
            temperature: 21.5,
            windSpeed: 2.5,
            humidity: 50,
            visibility: 20,
            precipitationProbability: 0,
            uvIndex: -1, // Negative
          });
          calculateTouringIndex(invalidWeather);
        }).toThrow(ZodError);
      });

      test("should throw ZodError for UV index above maximum (20)", () => {
        expect(() => {
          const invalidWeather = createWeather({
            datetime: "2025-06-01T12:00:00Z",
            condition: "clear",
            temperature: 21.5,
            windSpeed: 2.5,
            humidity: 50,
            visibility: 20,
            precipitationProbability: 0,
            uvIndex: 21, // Above maximum
          });
          calculateTouringIndex(invalidWeather);
        }).toThrow(ZodError);
      });
    });

    describe("Invalid Weather Condition", () => {
      test("should throw ZodError for invalid weather condition", () => {
        expect(() => {
          createWeather({
            datetime: "2025-06-01T12:00:00Z",
            condition: "tornado", // Invalid condition
            temperature: 21.5,
            windSpeed: 2.5,
            humidity: 50,
            visibility: 20,
            precipitationProbability: 0,
            uvIndex: 3,
          });
        }).toThrow(ZodError);
      });
    });

    describe("Invalid Air Quality", () => {
      test("should throw ZodError for invalid air quality level", () => {
        expect(() => {
          createWeather({
            datetime: "2025-06-01T12:00:00Z",
            condition: "clear",
            temperature: 21.5,
            windSpeed: 2.5,
            humidity: 50,
            visibility: 20,
            precipitationProbability: 0,
            uvIndex: 3,
            airQuality: "extreme", // Invalid air quality
          });
        }).toThrow(ZodError);
      });
    });

    describe("Invalid DateTime", () => {
      test("should throw ZodError for invalid datetime format", () => {
        expect(() => {
          createWeather({
            datetime: "invalid-date", // Invalid format
            condition: "clear",
            temperature: 21.5,
            windSpeed: 2.5,
            humidity: 50,
            visibility: 20,
            precipitationProbability: 0,
            uvIndex: 3,
          });
        }).toThrow(ZodError);
      });

      test("should throw ZodError for non-string datetime", () => {
        expect(() => {
          createWeather({
            datetime: 1234567890, // Non-string
            condition: "clear",
            temperature: 21.5,
            windSpeed: 2.5,
            humidity: 50,
            visibility: 20,
            precipitationProbability: 0,
            uvIndex: 3,
          });
        }).toThrow(ZodError);
      });
    });

    describe("Missing Required Fields", () => {
      test("should throw ZodError for missing datetime", () => {
        expect(() => {
          createWeather({
            // datetime missing
            condition: "clear",
            temperature: 21.5,
            windSpeed: 2.5,
            humidity: 50,
            visibility: 20,
            precipitationProbability: 0,
            uvIndex: 3,
          });
        }).toThrow(ZodError);
      });

      test("should throw ZodError for missing condition", () => {
        expect(() => {
          createWeather({
            datetime: "2025-06-01T12:00:00Z",
            // condition missing
            temperature: 21.5,
            windSpeed: 2.5,
            humidity: 50,
            visibility: 20,
            precipitationProbability: 0,
            uvIndex: 3,
          });
        }).toThrow(ZodError);
      });

      test("should throw ZodError for missing temperature", () => {
        expect(() => {
          createWeather({
            datetime: "2025-06-01T12:00:00Z",
            condition: "clear",
            // temperature missing
            windSpeed: 2.5,
            humidity: 50,
            visibility: 20,
            precipitationProbability: 0,
            uvIndex: 3,
          });
        }).toThrow(ZodError);
      });
    });
  });

  describe("Score Calculation Integration", () => {
    test("should ensure score never exceeds maximum (100)", () => {
      // Create weather with all maximum possible scores
      const maxScoreWeather: Weather = {
        datetime: "2025-06-01T12:00:00Z",
        condition: "clear",
        temperature: 21.5,
        windSpeed: 2.5,
        humidity: 50,
        visibility: 20,
        precipitationProbability: 0,
        uvIndex: 3,
        airQuality: "low",
      };

      const result = calculateTouringIndex(maxScoreWeather);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    test("should ensure score is never negative", () => {
      // Create weather with all minimum possible scores
      const minScoreWeather: Weather = {
        datetime: "2025-06-01T12:00:00Z",
        condition: "snow",
        temperature: -50,
        windSpeed: 50,
        humidity: 100,
        visibility: 0,
        precipitationProbability: 100,
        uvIndex: 20,
        airQuality: "high",
      };

      const result = calculateTouringIndex(minScoreWeather);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    test("should return integer score", () => {
      const weather: Weather = {
        datetime: "2025-06-01T12:00:00Z",
        condition: "clear",
        temperature: 20.3, // Non-ideal to create non-integer subscore
        windSpeed: 2.5,
        humidity: 45,
        visibility: 12,
        precipitationProbability: 15,
        uvIndex: 5,
        airQuality: "medium",
      };

      const result = calculateTouringIndex(weather);
      expect(Number.isInteger(result.score)).toBe(true);
    });
  });
});
