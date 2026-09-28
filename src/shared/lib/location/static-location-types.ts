import { z } from "zod";

const geoLocationSchema = z.object({
  name: z.string(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const geoDataSchema = z.object({
  locations: z.array(geoLocationSchema),
});
export const buildingImgRulesSchema = z.array(
  z.object({ regex: z.string(), path: z.string() }),
);
export type GeoLocation = z.infer<typeof geoLocationSchema>;
export type GeoData = z.infer<typeof geoDataSchema>;
export type BuildingImgRule = z.infer<typeof buildingImgRulesSchema>[number];
