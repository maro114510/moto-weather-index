import { z } from "zod";

// Validation schema for touring index query parameters
export const getTouringIndexSchema = z.object({
  lat: z.string().transform((val) => {
    const num = Number(val);
    if (Number.isNaN(num)) throw new Error("lat must be a valid number");
    if (num < -90 || num > 90)
      throw new Error("lat must be between -90 and 90");
    return num;
  }),
  lon: z.string().transform((val) => {
    const num = Number(val);
    if (Number.isNaN(num)) throw new Error("lon must be a valid number");
    if (num < -180 || num > 180)
      throw new Error("lon must be between -180 and 180");
    return num;
  }),
  datetime: z.string().optional(),
});

// Validation schema for batch processing parameters
export const batchParametersSchema = z.object({
  days: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return 16;
      const num = Number.parseInt(val, 10);
      if (Number.isNaN(num) || num < 1 || num > 30) {
        throw new Error("days parameter must be between 1 and 30");
      }
      return num;
    }),
  maxRetries: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return 3;
      const num = Number.parseInt(val, 10);
      if (Number.isNaN(num) || num < 1 || num > 10) {
        throw new Error("maxRetries parameter must be between 1 and 10");
      }
      return num;
    }),
});

// Type inference from schemas
export type GetTouringIndexParams = z.infer<typeof getTouringIndexSchema>;
export type BatchParametersParams = z.infer<typeof batchParametersSchema>;
