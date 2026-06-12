import * as z from "zod";

export const campusSchema = z.object({
  id: z.number().int(),
  jwId: z.number().int().nullable(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  code: z.string().nullable(),
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
});

export const roomTypeSchema = z.object({
  id: z.number().int(),
  jwId: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  code: z.string(),
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
});
