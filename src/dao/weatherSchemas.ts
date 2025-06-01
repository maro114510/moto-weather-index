import { z } from "zod";

// Validation schema for weather query parameters
export const getWeatherSchema = z.object({
  lat: z.string().transform((val) => {
    const num = Number(val);
    if (isNaN(num)) throw new Error("lat must be a valid number");
    if (num < -90 || num > 90) throw new Error("lat must be between -90 and 90");
    return num;
  }),
  lon: z.string().transform((val) => {
    const num = Number(val);
    if (isNaN(num)) throw new Error("lon must be a valid number");
    if (num < -180 || num > 180) throw new Error("lon must be between -180 and 180");
    return num;
  }),
  datetime: z.string().optional(),
});

// Type inference from schema
export type GetWeatherParams = z.infer<typeof getWeatherSchema>;
