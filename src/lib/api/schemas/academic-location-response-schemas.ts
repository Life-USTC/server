import * as z from "zod";
import { localizedNameFields } from "./academic-course-response-schemas";

export const campusSchema = z.object({
  id: z.number().int(),
  jwId: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  code: z.string().nullable(),
  ...localizedNameFields,
});

export const busCampusSchema = z.object({
  id: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
});

export const buildingSchema = z.object({
  id: z.number().int(),
  jwId: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  code: z.string(),
  campusId: z.number().int().nullable(),
  ...localizedNameFields,
});

export const roomTypeSchema = z.object({
  id: z.number().int(),
  jwId: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  code: z.string(),
  ...localizedNameFields,
});

export const roomSchema = z.object({
  id: z.number().int(),
  jwId: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  code: z.string(),
  floor: z.number().int().nullable(),
  virtual: z.boolean(),
  seatsForSection: z.number().int(),
  remark: z.string().nullable(),
  seats: z.number().int(),
  buildingId: z.number().int().nullable(),
  roomTypeId: z.number().int().nullable(),
  ...localizedNameFields,
});
