// src/dao/prefectureSchemas.ts
import { z } from "zod";

// Define prefecture schema for API responses
export const prefectureSchema = z.object({
  id: z.number(),
  name_ja: z.string(),
  name_en: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});

export type Prefecture = z.infer<typeof prefectureSchema>;

// Define schema for list prefectures response
export const prefectureListResponseSchema = z.object({
  prefectures: z.array(prefectureSchema),
  count: z.number(),
});

export type PrefectureListResponse = z.infer<
  typeof prefectureListResponseSchema
>;
