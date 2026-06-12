import * as z from "zod";
import { dateTimeSchema } from "./response-schema-primitives";

export const scheduleBaseSchema = z.object({
  id: z.number().int(),
  periods: z.number().int(),
  date: dateTimeSchema.nullable(),
  weekday: z.number().int(),
  startTime: z.string(),
  endTime: z.string(),
  experiment: z.string().nullable(),
  customPlace: z.string().nullable(),
  lessonType: z.string().nullable(),
  weekIndex: z.number().int(),
  exerciseClass: z.boolean().nullable(),
  startUnit: z.number().int(),
  endUnit: z.number().int(),
  roomId: z.number().int().nullable(),
  sectionId: z.number().int(),
  scheduleGroupId: z.number().int(),
});

export const scheduleGroupSchema = z.object({
  id: z.number().int(),
  jwId: z.number().int(),
  no: z.number().int(),
  limitCount: z.number().int(),
  stdCount: z.number().int(),
  actualPeriods: z.number().int(),
  isDefault: z.boolean(),
  sectionId: z.number().int(),
});
