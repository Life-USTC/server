import { z } from "zod";

export const compactBusCampusSchema = z.strictObject({
  id: z.number().int(),
  namePrimary: z.string(),
  nameSecondary: z.string().nullable(),
});
