import * as z from "zod";
import { homeworkUserSummarySchema } from "./homeworks-response-schemas";
import { dateTimeSchema } from "./response-schema-primitives";

const adminHomeworkSchema = z.object({
  id: z.string(),
  title: z.string(),
  submissionDueAt: dateTimeSchema.nullable(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
  deletedAt: dateTimeSchema.nullable(),
  section: z
    .object({
      id: z.number().int(),
      jwId: z.number().int().nullable(),
      code: z.string().nullable(),
      course: z.object({
        jwId: z.number().int(),
        code: z.string(),
        nameCn: z.string(),
      }),
    })
    .nullable(),
  createdBy: homeworkUserSummarySchema.nullable(),
  updatedBy: homeworkUserSummarySchema.nullable(),
  deletedBy: homeworkUserSummarySchema.nullable(),
});

export const adminHomeworksResponseSchema = z.object({
  homeworks: z.array(adminHomeworkSchema),
});
