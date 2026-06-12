import * as z from "zod";
import { homeworkUserSummarySchema } from "./homeworks-response-schemas";
import {
  createCollectionSchema,
  dateTimeSchema,
} from "./response-schema-primitives";

const adminDescriptionSchema = z.object({
  id: z.string(),
  content: z.string(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
  lastEditedAt: dateTimeSchema.nullable(),
  lastEditedById: z.string().nullable(),
  sectionId: z.number().int().nullable(),
  courseId: z.number().int().nullable(),
  teacherId: z.number().int().nullable(),
  homeworkId: z.string().nullable(),
  lastEditedBy: homeworkUserSummarySchema.nullable(),
  section: z
    .object({
      jwId: z.number().int().nullable(),
      code: z.string().nullable(),
      course: z
        .object({
          jwId: z.number().int(),
          code: z.string(),
          nameCn: z.string(),
        })
        .nullable(),
    })
    .nullable(),
  course: z
    .object({ jwId: z.number().int(), code: z.string(), nameCn: z.string() })
    .nullable(),
  teacher: z.object({ id: z.number().int(), nameCn: z.string() }).nullable(),
  homework: z
    .object({
      id: z.string(),
      title: z.string(),
      section: z
        .object({
          jwId: z.number().int().nullable(),
          code: z.string().nullable(),
          course: z
            .object({
              jwId: z.number().int(),
              code: z.string(),
              nameCn: z.string(),
            })
            .nullable(),
        })
        .nullable(),
    })
    .nullable(),
});

export const adminDescriptionsResponseSchema = createCollectionSchema(
  "descriptions",
  adminDescriptionSchema,
);
