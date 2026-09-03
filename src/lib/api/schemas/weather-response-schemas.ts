import * as z from "zod";
import { dateTimeSchema } from "./response-schema-primitives";

const weatherConditionSchema = z.strictObject({
  text: z.string(),
  icon: z.string(),
});

const weatherCurrentSchema = z.strictObject({
  temperature: z.number(),
  feelsLike: z.number().optional(),
  humidity: z.number().optional(),
  windDirection: z.string().optional(),
  windSpeed: z.number().optional(),
  pressure: z.number().optional(),
  visibility: z.number().optional(),
  condition: weatherConditionSchema,
});

const weatherHourlySchema = z.strictObject({
  at: dateTimeSchema,
  temperature: z.number(),
  condition: weatherConditionSchema.optional(),
  precipitationProbability: z.number().optional(),
  precipitationAmount: z.number().optional(),
});

const weatherDailySchema = z.strictObject({
  date: z.string(),
  temperatureHigh: z.number(),
  temperatureLow: z.number(),
  condition: weatherConditionSchema.optional(),
});

const weatherAlertSchema = z.strictObject({
  title: z.string(),
  level: z.string().optional(),
  content: z.string().optional(),
  issuedAt: dateTimeSchema.optional(),
});

export const weatherSnapshotResponseSchema = z.strictObject({
  location: z.strictObject({
    key: z.enum(["ustc-main", "ustc-gaoxin"]),
    name: z.string(),
    adcode: z.string(),
  }),
  fetchedAt: dateTimeSchema,
  providers: z.array(z.enum(["amap", "open-meteo"])),
  current: weatherCurrentSchema,
  hourly: z.array(weatherHourlySchema),
  daily: z.array(weatherDailySchema),
  alerts: z.array(weatherAlertSchema),
  extensions: z.strictObject({
    amap: z.unknown().optional(),
    openMeteo: z.unknown().optional(),
  }),
});
