import * as z from "zod";

export const catalogClassNameSchema = z.strictObject({
  nameCn: z.string(),
  nameEn: z.string().nullable(),
});

export const examMonitorSchema = z.strictObject({
  jwId: z.number().int(),
  nameCn: z.string().nullable(),
  nameEn: z.string().nullable(),
});
