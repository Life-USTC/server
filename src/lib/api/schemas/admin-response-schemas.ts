import * as z from "zod";
import { homeworkUserSummarySchema } from "./homeworks-response-schemas";
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

const adminSuspensionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  createdById: z.string(),
  createdAt: dateTimeSchema,
  reason: z.string().nullable(),
  note: z.string().nullable(),
  expiresAt: dateTimeSchema.nullable(),
  liftedAt: dateTimeSchema.nullable(),
  liftedById: z.string().nullable(),
  user: z
    .object({
      id: z.string(),
      name: z.string().nullable(),
    })
    .nullable()
    .optional(),
});

export const adminSuspensionsResponseSchema = createCollectionSchema(
  "suspensions",
  adminSuspensionSchema,
);

export const adminSuspensionResponseSchema = z.object({
  suspension: adminSuspensionSchema,
});

const adminUserListItemSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  username: z.string().nullable(),
  isAdmin: z.boolean(),
  createdAt: dateTimeSchema,
  email: z.string().nullable(),
});

export const adminUsersResponseSchema = z.object({
  data: z.array(adminUserListItemSchema),
  pagination: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});

export const adminUserResponseSchema = z.object({
  user: adminUserListItemSchema,
});
