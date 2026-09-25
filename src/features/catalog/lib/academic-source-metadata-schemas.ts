import * as z from "zod";

export const catalogClassNameSchema = z.strictObject({
  nameCn: z.string(),
  nameEn: z.string().nullable(),
});

export const examMonitorSchema = catalogClassNameSchema.extend({
  jwId: z.number().int(),
});
