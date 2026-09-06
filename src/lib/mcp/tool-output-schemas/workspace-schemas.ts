import { z } from "zod";
import { courseSchema } from "@/lib/api/schemas/academic-course-response-schemas";
import { subscribedExamSchema } from "@/lib/api/schemas/academic-exam-response-schemas";
import { campusSchema } from "@/lib/api/schemas/academic-location-response-schemas";
import { sectionBaseSchema } from "@/lib/api/schemas/academic-section-base-response-schemas";
import { sectionCompactSchema } from "@/lib/api/schemas/academic-section-response-schemas";
import { departmentSchema } from "@/lib/api/schemas/academic-teacher-response-schemas";
import { homeworkItemSchema } from "@/lib/api/schemas/homeworks-response-schemas";
import {
  todoCountsSchema,
  todoItemSchema,
} from "@/lib/api/schemas/misc-response-schema-core";
import { subscribedScheduleEntrySchema } from "@/lib/api/schemas/schedule-response-schema-core";
import {
  uploadSummarySchema,
  uploadsListResponseSchema,
} from "@/lib/api/schemas/uploads-response-schemas";

import {
  collectionOutputSchema,
  compactCampusSchema,
  compactCourseSchema,
  compactDepartmentSchema,
  compactSemesterSchema,
  exactSuccessOutput,
  objectOutputSchema,
} from "./builders";
import {
  compactExamBatchSchema,
  compactExamSchema,
  compactPersistedTeacherSchema,
  compactScheduleSchema,
  compactScheduleSectionSchema,
  compactScheduleTeacherSchema,
  compactTeacherIdentitySchema,
  compactTeacherTitleSchema,
} from "./catalog-schemas";
import {
  compactHomeworkSchema,
  compactHomeworkSectionSchema,
} from "./community-schemas";

export const compactWorkspaceScheduleTeacherSchema =
  compactScheduleTeacherSchema.extend({
    teacherTitle: compactTeacherTitleSchema.nullable(),
    _count: z.strictObject({ sections: z.number().int() }),
  });

export const compactSubscriptionSectionSchema = z.strictObject({
  id: z.number().int(),
  jwId: z.number().int(),
  code: z.string(),
  campusId: z.number().int().nullable(),
  openDepartmentId: z.number().int().nullable(),
  course: compactCourseSchema,
  semester: compactSemesterSchema.nullable(),
  campus: compactCampusSchema
    .omit({ latitude: true, longitude: true })
    .nullable(),
  openDepartment: compactDepartmentSchema.nullable(),
  teachers: z.array(compactPersistedTeacherSchema),
});

export const compactLocalizedSubscriptionSectionSchema =
  compactSubscriptionSectionSchema.extend({
    teachers: z.array(compactTeacherIdentitySchema),
  });

export const persistedLocalizedLabelSchema = z.strictObject({
  id: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
});

export const subscriptionFullCourseSchema = courseSchema.extend({
  category: persistedLocalizedLabelSchema.nullable(),
  classType: persistedLocalizedLabelSchema.nullable(),
  classify: persistedLocalizedLabelSchema.nullable(),
  educationLevel: persistedLocalizedLabelSchema.nullable(),
  gradation: persistedLocalizedLabelSchema.nullable(),
  type: persistedLocalizedLabelSchema.nullable(),
});

export const subscriptionFullSectionSchema = z.strictObject({
  ...sectionCompactSchema.shape,
  semester: compactSemesterSchema.nullable(),
});

export const compactWorkspaceHomeworkSectionSchema =
  compactHomeworkSectionSchema.extend({
    campus: compactCampusSchema
      .omit({ latitude: true, longitude: true })
      .nullable(),
    openDepartment: compactDepartmentSchema.nullable(),
  });

export const compactTodoSchema = todoItemSchema
  .pick({
    id: true,
    title: true,
    priority: true,
    dueAt: true,
    completed: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    content: todoItemSchema.shape.content.optional(),
  })
  .partial()
  .catchall(z.unknown());

export const compactWorkspaceHomeworkSchema = compactHomeworkSchema
  .omit({ createdBy: true, updatedBy: true, deletedBy: true })
  .extend({ section: compactWorkspaceHomeworkSectionSchema });

export const workspaceHomeworkFullSectionSchema = sectionBaseSchema.extend({
  course: subscriptionFullCourseSchema,
  semester: compactSemesterSchema.nullable(),
  campus: campusSchema.nullable(),
  openDepartment: departmentSchema.nullable(),
  examMode: persistedLocalizedLabelSchema.nullable(),
  teachLanguage: persistedLocalizedLabelSchema.nullable(),
});

export const workspaceHomeworkFullSchema = homeworkItemSchema
  .omit({
    section: true,
    createdBy: true,
    updatedBy: true,
    deletedBy: true,
  })
  .extend({ section: workspaceHomeworkFullSectionSchema })
  .strict();

export const calendarSubscriptionBriefSchema = z.strictObject({
  userId: z.string(),
  sectionCount: z.number().int().nonnegative(),
  currentSemesterSectionCount: z.number().int().nonnegative(),
  note: z.string(),
});

export const calendarSectionSummarySchema = z.strictObject({
  id: z.number().int(),
  jwId: z.number().int(),
  code: z.string(),
  course: z.strictObject({
    jwId: z.number().int(),
    code: z.string(),
    namePrimary: z.string(),
    nameSecondary: z.string().nullable(),
  }),
  semester: z
    .strictObject({
      id: z.number().int(),
      jwId: z.number().int(),
      code: z.string(),
      nameCn: z.string(),
    })
    .nullable(),
});

export const calendarSubscriptionReadSchema =
  calendarSubscriptionBriefSchema.extend({
    currentSemesterSections: z.array(calendarSectionSummarySchema),
  });

export const fullCalendarSubscriptionMutationSchema =
  calendarSubscriptionBriefSchema.extend({
    sections: z.array(subscriptionFullSectionSchema),
  });

export const fullCalendarSubscriptionReadSchema =
  calendarSubscriptionReadSchema.extend({
    sections: z.array(subscriptionFullSectionSchema),
  });

export const importSemesterSummarySchema = z.strictObject({
  id: z.number().int(),
  nameCn: z.string().nullable(),
  code: z.string().nullable(),
});

export const compactWorkspaceExamSectionSchema =
  compactScheduleSectionSchema.extend({
    campus: compactCampusSchema
      .omit({ latitude: true, longitude: true })
      .nullable(),
    openDepartment: compactDepartmentSchema.nullable(),
  });

export const compactWorkspaceScheduleSchema = compactScheduleSchema.extend({
  section: compactScheduleSectionSchema,
  teachers: z.array(compactWorkspaceScheduleTeacherSchema),
});

export const compactWorkspaceExamSchema = compactExamSchema.extend({
  section: compactWorkspaceExamSectionSchema,
  examBatch: compactExamBatchSchema.nullable(),
});

export function calendarFeedOutputSchema(subscriptionSchema: z.ZodType) {
  return z.union([
    exactSuccessOutput({ subscription: subscriptionSchema }),
    z.strictObject({ success: z.literal(false), message: z.string() }),
  ]);
}

export function calendarMutationOutputSchema(subscriptionSchema: z.ZodType) {
  return z.strictObject({
    success: z.boolean(),
    action: z.string(),
    sectionJwId: z.number().int(),
    subscription: subscriptionSchema.nullable(),
  });
}

export function subscriptionImportOutputSchema(subscriptionSchema: z.ZodType) {
  return z.union([
    exactSuccessOutput({
      semester: importSemesterSummarySchema,
      matchedCodes: z.array(z.string()),
      unmatchedCodes: z.array(z.string()),
      addedCount: z.number().int().nonnegative(),
      alreadySubscribedCount: z.number().int().nonnegative(),
      subscription: subscriptionSchema.nullable(),
    }),
    z.strictObject({ success: z.literal(false), message: z.string() }),
  ]);
}

export const subscribedScheduleEntryMcpSchema =
  subscribedScheduleEntrySchema.extend({
    section: subscribedScheduleEntrySchema.shape.section.extend({
      semester: compactSemesterSchema.nullable(),
    }),
  });
export const subscribedExamMcpSchema = subscribedExamSchema.extend({
  section: subscribedExamSchema.shape.section.extend({
    semester: compactSemesterSchema.nullable(),
  }),
});
export const todoListMcpSchema = objectOutputSchema({
  counts: todoCountsSchema,
  todos: collectionOutputSchema(compactTodoSchema),
});

export const uploadListMcpSchema = objectOutputSchema({
  data: collectionOutputSchema(uploadSummarySchema),
  pagination: uploadsListResponseSchema.shape.pagination,
  meta: uploadsListResponseSchema.shape.meta,
});
