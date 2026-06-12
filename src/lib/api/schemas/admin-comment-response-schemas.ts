import * as z from "zod";
import {
  createCollectionSchema,
  dateTimeSchema,
} from "./response-schema-primitives";
import {
  commentStatusSchema,
  commentVisibilitySchema,
} from "./shared-enum-schemas";

const adminCommentBaseSchema = z.object({
  id: z.string(),
  body: z.string(),
  visibility: commentVisibilitySchema,
  status: commentStatusSchema,
  isAnonymous: z.boolean(),
  authorName: z.string().nullable(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
  deletedAt: dateTimeSchema.nullable(),
  moderatedAt: dateTimeSchema.nullable(),
  moderationNote: z.string().nullable(),
  userId: z.string().nullable(),
  moderatedById: z.string().nullable(),
  parentId: z.string().nullable(),
  rootId: z.string().nullable(),
  sectionId: z.number().int().nullable(),
  courseId: z.number().int().nullable(),
  teacherId: z.number().int().nullable(),
  sectionTeacherId: z.number().int().nullable(),
  homeworkId: z.string().nullable(),
});

const adminCommentSchema = adminCommentBaseSchema.extend({
  user: z.object({ name: z.string().nullable() }).nullable(),
  section: z
    .object({
      jwId: z.number().int(),
      code: z.string(),
      course: z.object({
        jwId: z.number().int(),
        code: z.string(),
        nameCn: z.string(),
      }),
    })
    .nullable(),
  course: z
    .object({
      jwId: z.number().int(),
      code: z.string(),
      nameCn: z.string(),
    })
    .nullable(),
  teacher: z.object({ id: z.number().int(), nameCn: z.string() }).nullable(),
  homework: z
    .object({
      id: z.string(),
      title: z.string(),
      section: z.object({ code: z.string() }),
    })
    .nullable(),
  sectionTeacher: z
    .object({
      section: z.object({
        jwId: z.number().int(),
        code: z.string(),
        course: z.object({
          jwId: z.number().int(),
          code: z.string(),
          nameCn: z.string(),
        }),
      }),
      teacher: z.object({ nameCn: z.string() }),
    })
    .nullable(),
});

export const adminCommentsResponseSchema = createCollectionSchema(
  "comments",
  adminCommentSchema,
);

export const adminModeratedCommentResponseSchema = z.object({
  comment: adminCommentBaseSchema,
});
