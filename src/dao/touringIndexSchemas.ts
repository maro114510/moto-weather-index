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

// Validation schema for touring index history query parameters
export const getTouringIndexHistorySchema = z.object({
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
  startDate: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) {
        // Default to 7 days ago
        const date = new Date();
        date.setDate(date.getDate() - 7);
        return date.toISOString().split("T")[0];
      }
      // Validate date format YYYY-MM-DD
      if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        throw new Error("startDate must be in YYYY-MM-DD format");
      }

      // Strict date validation
      const [year, month, day] = val.split("-").map(Number);
      const date = new Date(year, month - 1, day);

      // Check if the date components match exactly (no auto-correction)
      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
      ) {
        throw new Error("startDate must be a valid date");
      }

      return val;
    }),
  endDate: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) {
        // Default to today
        return new Date().toISOString().split("T")[0];
      }
      // Validate date format YYYY-MM-DD
      if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        throw new Error("endDate must be in YYYY-MM-DD format");
      }

      // Strict date validation
      const [year, month, day] = val.split("-").map(Number);
      const date = new Date(year, month - 1, day);

      // Check if the date components match exactly (no auto-correction)
      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
      ) {
        throw new Error("endDate must be a valid date");
      }

      return val;
    }),
  prefectureId: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const num = Number.parseInt(val, 10);
      if (Number.isNaN(num) || num < 1 || num > 47) {
        throw new Error("prefectureId must be between 1 and 47");
      }
      return num;
    }),
});

// Type inference from schemas
export type GetTouringIndexParams = z.infer<typeof getTouringIndexSchema>;
export type GetTouringIndexHistoryParams = z.infer<
  typeof getTouringIndexHistorySchema
>;
