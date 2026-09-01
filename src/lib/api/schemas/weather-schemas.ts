import * as z from "zod";

export const weatherQuerySchema = z.object({
  locationKey: z.enum(["ustc-main", "ustc-gaoxin"]).default("ustc-main"),
});

export type WeatherQuery = z.output<typeof weatherQuerySchema>;
