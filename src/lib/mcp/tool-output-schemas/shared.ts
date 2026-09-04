import { z } from "zod";
import {
  courseBaseSchema,
  courseSchema,
} from "@/lib/api/schemas/academic-course-response-schemas";
import {
  examBatchSchema,
  examSchema,
  subscribedExamSchema,
} from "@/lib/api/schemas/academic-exam-response-schemas";
import { campusSchema } from "@/lib/api/schemas/academic-location-response-schemas";
import {
  paginatedCourseResponseSchema,
  paginatedSectionResponseSchema,
  paginatedSemesterResponseSchema,
  paginatedTeacherResponseSchema,
} from "@/lib/api/schemas/academic-paginated-response-schemas";
import {
  sectionBaseSchema,
  semesterSchema,
} from "@/lib/api/schemas/academic-section-base-response-schemas";
import { sectionPublicContextSchema } from "@/lib/api/schemas/academic-section-list-response-schemas";
import {
  courseDetailSchema,
  courseDetailSectionSchema,
  sectionCompactSchema,
  sectionDetailSchema,
  sectionSummarySchema,
  teacherDetailSchema,
  teacherDetailSectionSchema,
} from "@/lib/api/schemas/academic-section-response-schemas";
import {
  departmentSchema,
  departmentSummarySchema,
  teacherListSchema,
  teacherPublicIdentitySchema,
  teacherTitleSchema,
} from "@/lib/api/schemas/academic-teacher-response-schemas";
import { descriptionDetailSchema } from "@/lib/api/schemas/descriptions-response-schemas";
import { homeworkItemSchema } from "@/lib/api/schemas/homeworks-response-schemas";
import {
  matchSectionCodesResponseSchema,
  todoCountsSchema,
  todoItemSchema,
  viewerContextSchema,
} from "@/lib/api/schemas/misc-response-schema-core";
import { dateTimeSchema } from "@/lib/api/schemas/response-schema-primitives";
import {
  paginatedScheduleResponseSchema,
  scheduleBuildingSchema,
  scheduleEntrySchema,
  scheduleRoomSchema,
  scheduleTeacherSchema,
  sectionScheduleWithContextSchema,
  subscribedScheduleEntrySchema,
} from "@/lib/api/schemas/schedule-response-schema-core";
import {
  uploadDeleteResponseSchema,
  uploadRenameResponseSchema,
  uploadSummarySchema,
  uploadsListResponseSchema,
} from "@/lib/api/schemas/uploads-response-schemas";

export type OutputShape = Record<string, z.ZodType>;

export type McpToolOutputSchema = z.ZodType;

export const COMMON_OUTPUT_SHAPE = {
  success: z.boolean(),
  found: z.boolean().optional(),
  error: z.unknown().optional(),
  message: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  hint: z.string().optional(),
  result: z.unknown().optional(),
} satisfies OutputShape;

export const STRUCTURED_CONTENT_OUTPUT_SCHEMA = z
  .object(COMMON_OUTPUT_SHAPE)
  .strict()
  .describe("Object returned in structuredContent with an explicit status.");

export function optionalizeShape(shape: OutputShape) {
  return Object.fromEntries(
    Object.entries(shape).map(([key, schema]) => [key, schema.optional()]),
  ) as OutputShape;
}

export function objectOutputSchema(shape: OutputShape) {
  return z
    .object({
      ...optionalizeShape(shape),
      ...COMMON_OUTPUT_SHAPE,
    })
    .strict()
    .describe("Canonical object returned in structuredContent.");
}

export function objectOutputSchemaFromApi(schema: { shape: OutputShape }) {
  return objectOutputSchema(schema.shape);
}

export function topLevelOutputSchema(keys: string[]) {
  return objectOutputSchema(
    Object.fromEntries(keys.map((key) => [key, z.unknown()])) as OutputShape,
  );
}

export function collectionOutputSchema(itemSchema: z.ZodType) {
  return z.array(itemSchema);
}

export function compactObjectSchema(shape: OutputShape) {
  return z.object(optionalizeShape(shape)).catchall(z.unknown());
}

export const compactUserSchema = z.strictObject({
  id: z.string(),
  name: z.string().nullable(),
  username: z.string().nullable(),
  image: z.string().nullable(),
});

export const publicProfileFullUserSchema = compactUserSchema.extend({
  createdAt: dateTimeSchema,
  _count: z.strictObject({
    comments: z.number().int().nonnegative(),
    homeworksCreated: z.number().int().nonnegative(),
    subscribedSections: z.number().int().nonnegative(),
    uploads: z.number().int().nonnegative(),
  }),
});

export const contributionWeeksSchema = z.array(
  z.array(
    z.strictObject({
      date: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
);

export const compactDepartmentSchema = departmentSummarySchema
  .pick({
    id: true,
    nameCn: true,
    nameEn: true,
    namePrimary: true,
    nameSecondary: true,
  })
  .strict();

export const compactTeacherTitleSchema = teacherTitleSchema
  .pick({
    id: true,
    nameCn: true,
    nameEn: true,
    namePrimary: true,
    nameSecondary: true,
  })
  .strict();

export const compactCourseSchema = courseSchema
  .pick({
    id: true,
    jwId: true,
    code: true,
    nameCn: true,
    nameEn: true,
    namePrimary: true,
    nameSecondary: true,
  })
  .strict();

export const compactCourseReferenceSchema = compactCourseSchema.omit({
  id: true,
});

export const compactSemesterFields = semesterSchema.pick({
  id: true,
  jwId: true,
  code: true,
  nameCn: true,
  startDate: true,
  endDate: true,
}).shape;
export const compactSemesterSchema = z.object(compactSemesterFields).strict();
export const compactSemesterReferenceSchema = compactSemesterSchema.pick({
  jwId: true,
  code: true,
  nameCn: true,
});

export const compactTeacherIdentitySchema =
  teacherPublicIdentitySchema.strict();

export const compactScheduleTeacherSchema = scheduleTeacherSchema
  .pick({
    id: true,
    jwId: true,
    personId: true,
    code: true,
    nameCn: true,
    nameEn: true,
    namePrimary: true,
    nameSecondary: true,
  })
  .extend({ department: compactDepartmentSchema.nullable() })
  .strict();

export const compactCatalogTeacherSchema = teacherListSchema
  .pick({
    id: true,
    jwId: true,
    personId: true,
    code: true,
    nameCn: true,
    nameEn: true,
    namePrimary: true,
    nameSecondary: true,
    _count: true,
  })
  .extend({
    department: compactDepartmentSchema.nullable(),
    teacherTitle: compactTeacherTitleSchema.nullable(),
  })
  .strict();

export const compactPersistedTeacherSchema = z.strictObject({
  id: z.number().int(),
  personId: z.number().int().nullable(),
  code: z.string().nullable(),
  jwId: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
});

export const compactWorkspaceScheduleTeacherSchema =
  compactScheduleTeacherSchema.extend({
    teacherTitle: compactTeacherTitleSchema.nullable(),
    _count: z.strictObject({ sections: z.number().int() }),
  });

export const compactTeacherReferenceSchema =
  compactScheduleTeacherSchema.extend({
    teacherTitle: compactTeacherTitleSchema.nullable(),
  });

export const compactCampusSchema = campusSchema
  .pick({
    id: true,
    nameCn: true,
    nameEn: true,
    namePrimary: true,
    nameSecondary: true,
  })
  .extend({
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
  })
  .strict();

export const compactBusCampusSchema = z.strictObject({
  id: z.number().int(),
  namePrimary: z.string(),
  nameSecondary: z.string().nullable(),
});

export const compactSectionContextSchema = z
  .object({
    id: z.number().int(),
    jwId: z.number().int(),
    code: z.string(),
    course: compactCourseReferenceSchema,
    semester: compactSemesterReferenceSchema.nullable(),
  })
  .strict();

export const compactSectionFullSchema = z
  .object({
    id: z.number().int(),
    jwId: z.number().int(),
    code: z.string(),
    campusId: z.number().int().nullable(),
    openDepartmentId: z.number().int().nullable(),
    course: compactCourseSchema,
    semester: compactSemesterSchema.nullable(),
    campus: compactCampusSchema.nullable().optional(),
    openDepartment: compactDepartmentSchema.nullable().optional(),
    teachers: z.array(compactTeacherIdentitySchema).optional(),
  })
  .strict();

export const compactSectionSchema = z.union([
  compactSectionContextSchema,
  compactSectionFullSchema,
]);

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

export const compactHomeworkSectionSchema = z.strictObject({
  id: z.number().int(),
  jwId: z.number().int(),
  code: z.string(),
  campusId: z.number().int().nullable(),
  openDepartmentId: z.number().int().nullable(),
  course: compactCourseSchema,
  semester: compactSemesterSchema.nullable(),
});

export const compactWorkspaceHomeworkSectionSchema =
  compactHomeworkSectionSchema.extend({
    campus: compactCampusSchema
      .omit({ latitude: true, longitude: true })
      .nullable(),
    openDepartment: compactDepartmentSchema.nullable(),
  });

export const compactHomeworkDescriptionSchema = z.strictObject({
  id: z.string(),
  content: z.string(),
  lastEditedAt: dateTimeSchema.nullable(),
  lastEditedById: z.string().nullable(),
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

export const compactHomeworkSchema = z.strictObject({
  id: z.string(),
  sectionId: z.number().int(),
  title: z.string(),
  isMajor: z.boolean(),
  requiresTeam: z.boolean(),
  publishedAt: dateTimeSchema.nullable(),
  submissionStartAt: dateTimeSchema.nullable(),
  submissionDueAt: dateTimeSchema.nullable(),
  deletedAt: dateTimeSchema.nullable(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
  description: compactHomeworkDescriptionSchema.nullable(),
  section: compactHomeworkSectionSchema,
  createdBy: compactUserSchema.nullable(),
  updatedBy: compactUserSchema.nullable(),
  deletedBy: compactUserSchema.nullable(),
  completion: z.strictObject({ completedAt: dateTimeSchema }).nullable(),
  commentCount: z.number().int().nonnegative(),
});

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

export const compactScheduleSchema = scheduleEntrySchema
  .pick({
    id: true,
    periods: true,
    date: true,
    weekday: true,
    startTime: true,
    endTime: true,
    weekIndex: true,
    customPlace: true,
    startUnit: true,
    endUnit: true,
  })
  .extend({
    section: compactSectionSchema.optional(),
    teachers: z.array(compactScheduleTeacherSchema),
    room: scheduleRoomSchema
      .pick({
        id: true,
        jwId: true,
        namePrimary: true,
        nameSecondary: true,
      })
      .extend({
        building: scheduleBuildingSchema
          .pick({
            id: true,
            jwId: true,
            namePrimary: true,
            nameSecondary: true,
          })
          .extend({ campus: compactCampusSchema.nullable().optional() })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const compactExamBatchSchema = examBatchSchema
  .pick({ id: true, namePrimary: true, nameSecondary: true })
  .strict();

export const compactExamSchema = examSchema
  .pick({
    id: true,
    jwId: true,
    examDate: true,
    startTime: true,
    endTime: true,
    examType: true,
    examMode: true,
    examTakeCount: true,
    examRooms: true,
  })
  .extend({
    section: compactSectionSchema.optional(),
    examBatch: compactExamBatchSchema.nullable().optional(),
    examRooms: z.array(
      z.strictObject({
        id: z.number().int(),
        room: z.string(),
        count: z.number().int(),
      }),
    ),
  })
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

export function exactSuccessOutput(shape: OutputShape) {
  return z.strictObject({ success: z.literal(true), ...shape });
}

export const exactFailureOutputSchema = z.strictObject({
  success: z.literal(false),
  found: z.literal(false).optional(),
  message: z.string(),
  hint: z.string().optional(),
});

export const homeworkItemFullMcpSchema = homeworkItemSchema
  .extend({
    section: homeworkItemSchema.shape.section.extend({
      semester: compactSemesterSchema.nullable(),
    }),
  })
  .strict();

export const compactSectionHomeworkItemSchema = compactHomeworkSchema.omit({
  section: true,
  description: true,
  createdBy: true,
  updatedBy: true,
  deletedBy: true,
});

export const sectionHomeworkNotFoundSchema = z.strictObject({
  success: z.literal(false),
  found: z.literal(false),
  message: z.string(),
  hint: z.string(),
});

export const sectionHomeworkListDefaultSchema = z.union([
  z.strictObject({
    success: z.literal(true),
    found: z.literal(true),
    section: sectionPublicContextSchema,
    homeworks: z.array(compactSectionHomeworkItemSchema),
  }),
  sectionHomeworkNotFoundSchema,
]);

export const sectionHomeworkListFullSchema = z.union([
  z.strictObject({
    success: z.literal(true),
    found: z.literal(true),
    section: sectionPublicContextSchema,
    homeworks: z.array(compactSectionHomeworkItemSchema),
  }),
  sectionHomeworkNotFoundSchema,
]);

export const homeworkMutationFailureSchema = z.union([
  z.strictObject({ success: z.literal(false), message: z.string() }),
  z.strictObject({
    success: z.literal(false),
    message: z.string(),
    reason: z.string().nullable(),
  }),
  exactFailureOutputSchema,
]);

export const importSemesterSummarySchema = z.strictObject({
  id: z.number().int(),
  nameCn: z.string().nullable(),
  code: z.string().nullable(),
});

export const compactSectionSummarySchema = z.strictObject({
  id: z.number().int(),
  jwId: z.number().int(),
  code: z.string(),
  campusId: z.number().int().nullable(),
  openDepartmentId: z.number().int().nullable(),
  course: compactCourseSchema,
  semester: z
    .strictObject({
      id: z.number().int(),
      jwId: z.number().int(),
      code: z.string(),
      nameCn: z.string(),
    })
    .nullable(),
  campus: compactCampusSchema
    .omit({ latitude: true, longitude: true })
    .nullable(),
  teachers: z.array(compactTeacherIdentitySchema),
});

export const compactSectionDetailSchema = z.strictObject({
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
  teachers: z.array(compactTeacherReferenceSchema),
});

export const compactMatchSectionSchema = compactSectionFullSchema.extend({
  campus: compactCampusSchema
    .omit({ latitude: true, longitude: true })
    .nullable(),
  openDepartment: compactDepartmentSchema.nullable(),
  teachers: z.array(compactTeacherIdentitySchema),
});

export const compactTeacherDetailSectionSchema = z.strictObject({
  id: z.number().int(),
  jwId: z.number().int(),
  code: z.string(),
  campusId: z.number().int().nullable(),
  openDepartmentId: z.number().int().nullable(),
  course: compactCourseSchema,
  semester: compactSemesterSchema.nullable(),
});

export const compactTeacherDetailSchema = compactCatalogTeacherSchema.extend({
  sections: z.array(compactTeacherDetailSectionSchema),
});

export const compactScheduleSectionSchema = z.strictObject({
  id: z.number().int(),
  jwId: z.number().int(),
  code: z.string(),
  campusId: z.number().int().nullable(),
  openDepartmentId: z.number().int().nullable(),
  course: compactCourseSchema,
  semester: compactSemesterSchema.nullable(),
});

export const compactWorkspaceExamSectionSchema =
  compactScheduleSectionSchema.extend({
    campus: compactCampusSchema
      .omit({ latitude: true, longitude: true })
      .nullable(),
    openDepartment: compactDepartmentSchema.nullable(),
  });

export const compactPublicScheduleSchema = compactScheduleSchema.extend({
  section: compactScheduleSectionSchema,
});

export const compactScopedScheduleSchema = compactScheduleSchema.omit({
  section: true,
});

export const compactWorkspaceScheduleSchema = compactScheduleSchema.extend({
  section: compactScheduleSectionSchema,
  teachers: z.array(compactWorkspaceScheduleTeacherSchema),
});

export const fullCatalogExamSchema = examSchema.extend({
  section: sectionBaseSchema.extend({ course: courseBaseSchema }),
});

export const paginatedCourseDefaultMcpSchema = exactSuccessOutput({
  data: z.array(compactCourseSchema),
  pagination: paginatedCourseResponseSchema.shape.pagination,
});
export const paginatedCourseFullMcpSchema = exactSuccessOutput({
  data: z.array(courseSchema),
  pagination: paginatedCourseResponseSchema.shape.pagination,
});
export const paginatedSectionDefaultMcpSchema = exactSuccessOutput({
  data: z.array(compactSectionSummarySchema),
  pagination: paginatedSectionResponseSchema.shape.pagination,
});
export const paginatedSectionFullMcpSchema = exactSuccessOutput({
  data: z.array(sectionSummarySchema),
  pagination: paginatedSectionResponseSchema.shape.pagination,
});
export const paginatedTeacherDefaultMcpSchema = exactSuccessOutput({
  data: z.array(compactCatalogTeacherSchema),
  pagination: paginatedTeacherResponseSchema.shape.pagination,
});
export const paginatedTeacherFullMcpSchema = exactSuccessOutput({
  data: z.array(teacherListSchema),
  pagination: paginatedTeacherResponseSchema.shape.pagination,
});
export const paginatedScheduleDefaultMcpSchema = exactSuccessOutput({
  data: z.array(compactPublicScheduleSchema),
  pagination: paginatedScheduleResponseSchema.shape.pagination,
});
export const paginatedScheduleFullMcpSchema = exactSuccessOutput({
  data: z.array(scheduleEntrySchema),
  pagination: paginatedScheduleResponseSchema.shape.pagination,
});

export const compactExamSectionSchema = z.strictObject({
  id: z.number().int(),
  jwId: z.number().int(),
  code: z.string(),
  campusId: z.number().int().nullable(),
  openDepartmentId: z.number().int().nullable(),
  course: compactCourseSchema,
});

export const compactCatalogExamSchema = compactExamSchema.extend({
  section: compactExamSectionSchema,
  examBatch: compactExamBatchSchema.nullable(),
});

export const compactWorkspaceExamSchema = compactExamSchema.extend({
  section: compactWorkspaceExamSectionSchema,
  examBatch: compactExamBatchSchema.nullable(),
});

export const sectionContextFullSchema = z.strictObject({
  id: z.number().int(),
  jwId: z.number().int(),
  code: z.string(),
  course: compactCourseReferenceSchema,
  semester: compactSemesterReferenceSchema.nullable(),
});

export const sectionGetDefaultSchema = z.union([
  exactSuccessOutput({
    found: z.literal(true),
    section: compactSectionDetailSchema,
  }),
  exactFailureOutputSchema,
]);
export const sectionGetFullSchema = z.union([
  exactSuccessOutput({
    found: z.literal(true),
    section: sectionDetailSchema,
  }),
  exactFailureOutputSchema,
]);

export const homeworkCreateDefaultSchema = z.union([
  exactSuccessOutput({ id: z.string(), homework: compactHomeworkSchema }),
  homeworkMutationFailureSchema,
]);
export const homeworkCreateFullSchema = z.union([
  exactSuccessOutput({ id: z.string(), homework: homeworkItemFullMcpSchema }),
  homeworkMutationFailureSchema,
]);
export const homeworkUpdateDefaultSchema = z.union([
  exactSuccessOutput({ homework: compactHomeworkSchema }),
  homeworkMutationFailureSchema,
]);
export const homeworkUpdateFullSchema = z.union([
  exactSuccessOutput({ homework: homeworkItemFullMcpSchema }),
  homeworkMutationFailureSchema,
]);

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

export function sectionCalendarFeedOutputSchema(sectionSchema: z.ZodType) {
  const feedLocationShape = {
    calendarPath: z.string(),
    calendarUrl: z.string(),
    success: z.literal(true),
  };
  return z.union([
    z.strictObject({
      found: z.literal(true),
      section: sectionSchema,
      ...feedLocationShape,
    }),
    z.strictObject({
      found: z.literal(false),
      section: z.null(),
      ...feedLocationShape,
    }),
  ]);
}

export function publicProfileOutputSchema(userSchema: z.ZodType) {
  return z.union([
    exactSuccessOutput({
      found: z.literal(true),
      user: userSchema,
      sectionCount: z.number().int().nonnegative(),
      weeks: contributionWeeksSchema,
      totalContributions: z.number().int().nonnegative(),
    }),
    z.strictObject({
      success: z.literal(false),
      found: z.literal(false),
      error: z.literal("not_found"),
      message: z.string(),
    }),
  ]);
}

export const courseDetailSectionMcpSchema = courseDetailSectionSchema.extend({
  semester: compactSemesterSchema.nullable(),
});
export const courseDetailMcpSchema = courseDetailSchema.extend({
  sections: z.array(courseDetailSectionMcpSchema),
});
export const sectionDetailMcpSchema = sectionDetailSchema.extend({
  semester: compactSemesterSchema.nullable(),
});
export const teacherDetailSectionMcpSchema = teacherDetailSectionSchema.extend({
  semester: compactSemesterSchema.nullable(),
});
export const teacherDetailMcpSchema = teacherDetailSchema.extend({
  sections: z.array(teacherDetailSectionMcpSchema),
});
export const scheduleEntryMcpSchema = scheduleEntrySchema.extend({
  section: scheduleEntrySchema.shape.section.extend({
    semester: compactSemesterSchema.nullable(),
  }),
});
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
export const sectionCompactMcpSchema = sectionCompactSchema.extend({
  semester: compactSemesterSchema.nullable(),
});

export const paginatedSemesterMcpSchema = objectOutputSchema({
  data: collectionOutputSchema(compactSemesterSchema),
  pagination: paginatedSemesterResponseSchema.shape.pagination,
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

export {
  courseDetailSchema,
  courseDetailSectionSchema,
  courseSchema,
  dateTimeSchema,
  descriptionDetailSchema,
  matchSectionCodesResponseSchema,
  paginatedCourseResponseSchema,
  paginatedScheduleResponseSchema,
  paginatedSectionResponseSchema,
  paginatedSemesterResponseSchema,
  paginatedTeacherResponseSchema,
  scheduleEntrySchema,
  sectionCompactSchema,
  sectionDetailSchema,
  sectionPublicContextSchema,
  sectionScheduleWithContextSchema,
  sectionSummarySchema,
  subscribedExamSchema,
  subscribedScheduleEntrySchema,
  teacherDetailSchema,
  teacherListSchema,
  uploadDeleteResponseSchema,
  uploadRenameResponseSchema,
  uploadSummarySchema,
  uploadsListResponseSchema,
  viewerContextSchema,
};
