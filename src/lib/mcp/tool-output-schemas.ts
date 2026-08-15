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
  departmentSummarySchema,
  teacherListSchema,
  teacherPublicIdentitySchema,
  teacherTitleSchema,
} from "@/lib/api/schemas/academic-teacher-response-schemas";
import {
  commentAttachmentSummarySchema,
  commentAuthorSummarySchema,
  commentReactionSummarySchema,
} from "@/lib/api/schemas/comment-node-response-schema";
import { commentsListResponseSchema } from "@/lib/api/schemas/comments-response-schemas";
import {
  descriptionDetailSchema,
  descriptionHistoryEntrySchema,
} from "@/lib/api/schemas/descriptions-response-schemas";
import {
  matchSectionCodesResponseSchema,
  meResponseSchema,
  successResponseSchema,
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

type OutputShape = Record<string, z.ZodType>;

export type McpToolOutputSchema = z.ZodType;

const COMMON_OUTPUT_SHAPE = {
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

function optionalizeShape(shape: OutputShape) {
  return Object.fromEntries(
    Object.entries(shape).map(([key, schema]) => [key, schema.optional()]),
  ) as OutputShape;
}

function objectOutputSchema(shape: OutputShape) {
  return z
    .object({
      ...optionalizeShape(shape),
      ...COMMON_OUTPUT_SHAPE,
    })
    .strict()
    .describe("Canonical object returned in structuredContent.");
}

function objectOutputSchemaFromApi(schema: { shape: OutputShape }) {
  return objectOutputSchema(schema.shape);
}

function topLevelOutputSchema(keys: string[]) {
  return objectOutputSchema(
    Object.fromEntries(keys.map((key) => [key, z.unknown()])) as OutputShape,
  );
}

function collectionOutputSchema(itemSchema: z.ZodType) {
  return z.array(itemSchema);
}

function compactObjectSchema(shape: OutputShape) {
  return z.object(optionalizeShape(shape)).catchall(z.unknown());
}

const compactUserSchema = compactObjectSchema({
  id: z.string(),
  name: z.string().nullable(),
  username: z.string().nullable(),
  image: z.string().nullable(),
});

const compactDepartmentSchema = departmentSummarySchema
  .pick({
    id: true,
    nameCn: true,
    nameEn: true,
    namePrimary: true,
    nameSecondary: true,
  })
  .strict();

const compactTeacherTitleSchema = teacherTitleSchema
  .pick({
    id: true,
    nameCn: true,
    nameEn: true,
    namePrimary: true,
    nameSecondary: true,
  })
  .strict();

const compactCourseSchema = courseSchema
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

const compactCourseReferenceSchema = compactCourseSchema.omit({ id: true });

const compactSemesterFields = semesterSchema.pick({
  id: true,
  jwId: true,
  code: true,
  nameCn: true,
  startDate: true,
  endDate: true,
}).shape;
const compactSemesterSchema = z.object(compactSemesterFields).strict();
const compactSemesterReferenceSchema = compactSemesterSchema.pick({
  jwId: true,
  code: true,
  nameCn: true,
});

const compactTeacherIdentitySchema = teacherPublicIdentitySchema.strict();

const compactScheduleTeacherSchema = scheduleTeacherSchema
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

const compactCatalogTeacherSchema = teacherListSchema
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

const compactWorkspaceScheduleTeacherSchema = compactScheduleTeacherSchema
  .extend({
    teacherTitle: compactTeacherTitleSchema.nullable(),
    _count: z.strictObject({ sections: z.number().int() }),
  })
  .strict();

const compactTeacherReferenceSchema = compactScheduleTeacherSchema.extend({
  teacherTitle: compactTeacherTitleSchema.nullable(),
});

const compactCampusSchema = campusSchema
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

const compactSectionContextSchema = z
  .object({
    id: z.number().int(),
    jwId: z.number().int(),
    code: z.string(),
    course: compactCourseReferenceSchema,
    semester: compactSemesterReferenceSchema.nullable(),
  })
  .strict();

const compactSectionFullSchema = z
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

const compactSectionSchema = z.union([
  compactSectionContextSchema,
  compactSectionFullSchema,
]);

const compactTodoSchema = todoItemSchema
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

const compactHomeworkSchema = compactObjectSchema({
  id: z.string(),
  sectionId: z.number().int(),
  title: z.string(),
  isMajor: z.boolean().nullable(),
  requiresTeam: z.boolean().nullable(),
  publishedAt: dateTimeSchema.nullable(),
  submissionStartAt: dateTimeSchema.nullable(),
  submissionDueAt: dateTimeSchema.nullable(),
  deletedAt: dateTimeSchema.nullable(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
  section: compactSectionSchema.nullable(),
  createdBy: compactUserSchema.nullable(),
  updatedBy: compactUserSchema.nullable(),
  deletedBy: compactUserSchema.nullable(),
  completion: z.unknown(),
  commentCount: z.number().int().nonnegative(),
});

const compactScheduleSchema = scheduleEntrySchema
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

const compactExamBatchSchema = examBatchSchema
  .pick({ id: true, namePrimary: true, nameSecondary: true })
  .strict();

const compactExamSchema = examSchema
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
  })
  .strict();

const compactBusRouteSchema = compactObjectSchema({
  id: z.number().int(),
  routeId: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  descriptionPrimary: z.string().nullable(),
  descriptionSecondary: z.string().nullable(),
  weekdayTrips: z.number().int().nonnegative(),
  weekendTrips: z.number().int().nonnegative(),
  stopCount: z.number().int().nonnegative(),
  stops: z.array(z.unknown()),
  originCampus: compactCampusSchema.nullable(),
  destinationCampus: compactCampusSchema.nullable(),
});

const compactBusTripSchema = compactObjectSchema({
  id: z.number().int(),
  tripId: z.number().int(),
  routeId: z.number().int(),
  dayType: z.string(),
  position: z.number().int(),
  departureTime: z.string().nullable(),
  arrivalTime: z.string().nullable(),
  departureMinutes: z.number().int().nullable(),
  arrivalMinutes: z.number().int().nullable(),
  minutesUntilDeparture: z.number().int().nullable(),
  status: z.string().nullable(),
  stopTimes: z.unknown(),
  route: compactBusRouteSchema.nullable(),
  originCampus: compactCampusSchema.nullable(),
  destinationCampus: compactCampusSchema.nullable(),
});

const compactCalendarSubscriptionSchema = compactObjectSchema({
  userId: z.string(),
  sectionCount: z.number().int().nonnegative(),
  currentSemesterSectionCount: z.number().int().nonnegative(),
  currentSemesterSections: z.array(compactSectionSchema),
  sections: z.array(compactSectionSchema),
  calendarPath: z.string().nullable(),
  calendarUrl: z.string().nullable(),
  note: z.string(),
});

function exactSuccessOutput(shape: OutputShape) {
  return z.strictObject({ success: z.literal(true), ...shape });
}

const exactFailureOutputSchema = z.strictObject({
  success: z.literal(false),
  found: z.literal(false).optional(),
  message: z.string(),
  hint: z.string().optional(),
});

const compactSectionSummarySchema = z.strictObject({
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

const compactSectionDetailSchema = z.strictObject({
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

const compactMatchSectionSchema = compactSectionFullSchema.extend({
  campus: compactCampusSchema
    .omit({ latitude: true, longitude: true })
    .nullable(),
  openDepartment: compactDepartmentSchema.nullable(),
  teachers: z.array(compactTeacherIdentitySchema),
});

const compactTeacherDetailSectionSchema = z.strictObject({
  id: z.number().int(),
  jwId: z.number().int(),
  code: z.string(),
  campusId: z.number().int().nullable(),
  openDepartmentId: z.number().int().nullable(),
  course: compactCourseSchema,
  semester: compactSemesterSchema.nullable(),
});

const compactTeacherDetailSchema = compactCatalogTeacherSchema.extend({
  sections: z.array(compactTeacherDetailSectionSchema),
});

const compactScheduleSectionSchema = z.strictObject({
  id: z.number().int(),
  jwId: z.number().int(),
  code: z.string(),
  campusId: z.number().int().nullable(),
  openDepartmentId: z.number().int().nullable(),
  course: compactCourseSchema,
  semester: compactSemesterSchema.nullable(),
});

const compactPublicScheduleSchema = compactScheduleSchema.extend({
  section: compactScheduleSectionSchema,
});

const compactScopedScheduleSchema = compactScheduleSchema.omit({
  section: true,
});

const compactWorkspaceScheduleSchema = compactPublicScheduleSchema.extend({
  teachers: z.array(compactWorkspaceScheduleTeacherSchema),
});

const fullCatalogExamSchema = examSchema.extend({
  section: sectionBaseSchema.extend({ course: courseBaseSchema }),
});

const paginatedCourseDefaultMcpSchema = exactSuccessOutput({
  data: z.array(compactCourseSchema),
  pagination: paginatedCourseResponseSchema.shape.pagination,
});
const paginatedCourseFullMcpSchema = exactSuccessOutput({
  data: z.array(courseSchema),
  pagination: paginatedCourseResponseSchema.shape.pagination,
});
const paginatedSectionDefaultMcpSchema = exactSuccessOutput({
  data: z.array(compactSectionSummarySchema),
  pagination: paginatedSectionResponseSchema.shape.pagination,
});
const paginatedSectionFullMcpSchema = exactSuccessOutput({
  data: z.array(sectionSummarySchema),
  pagination: paginatedSectionResponseSchema.shape.pagination,
});
const paginatedTeacherDefaultMcpSchema = exactSuccessOutput({
  data: z.array(compactCatalogTeacherSchema),
  pagination: paginatedTeacherResponseSchema.shape.pagination,
});
const paginatedTeacherFullMcpSchema = exactSuccessOutput({
  data: z.array(teacherListSchema),
  pagination: paginatedTeacherResponseSchema.shape.pagination,
});
const paginatedScheduleDefaultMcpSchema = exactSuccessOutput({
  data: z.array(compactPublicScheduleSchema),
  pagination: paginatedScheduleResponseSchema.shape.pagination,
});
const paginatedScheduleFullMcpSchema = exactSuccessOutput({
  data: z.array(scheduleEntrySchema),
  pagination: paginatedScheduleResponseSchema.shape.pagination,
});

const compactExamSectionSchema = z.strictObject({
  id: z.number().int(),
  jwId: z.number().int(),
  code: z.string(),
  campusId: z.number().int().nullable(),
  openDepartmentId: z.number().int().nullable(),
  course: compactCourseSchema,
});

const compactCatalogExamSchema = compactExamSchema.extend({
  section: compactExamSectionSchema,
  examBatch: compactExamBatchSchema.nullable(),
});

const compactWorkspaceExamSchema = compactExamSchema.extend({
  section: compactScheduleSectionSchema,
  examBatch: compactExamBatchSchema.nullable(),
});

const sectionContextFullSchema = z.strictObject({
  id: z.number().int(),
  jwId: z.number().int(),
  code: z.string(),
  course: compactCourseReferenceSchema,
  semester: compactSemesterReferenceSchema.nullable(),
});

const sectionGetDefaultSchema = z.union([
  exactSuccessOutput({
    found: z.literal(true),
    section: compactSectionDetailSchema,
  }),
  exactFailureOutputSchema,
]);
const sectionGetFullSchema = z.union([
  exactSuccessOutput({
    found: z.literal(true),
    section: sectionDetailSchema,
  }),
  exactFailureOutputSchema,
]);

const academicModeOutputSchemas = {
  catalog_course_search: {
    default: paginatedCourseDefaultMcpSchema,
    full: paginatedCourseFullMcpSchema,
  },
  catalog_course_get: {
    default: exactSuccessOutput({
      found: z.boolean(),
      course: compactCourseSchema.nullable(),
    }),
    full: exactSuccessOutput({
      found: z.boolean(),
      course: courseDetailSchema.nullable(),
    }),
  },
  catalog_section_search: {
    default: paginatedSectionDefaultMcpSchema,
    full: paginatedSectionFullMcpSchema,
  },
  catalog_section_get: {
    default: sectionGetDefaultSchema,
    full: sectionGetFullSchema,
  },
  catalog_section_match_preview: {
    default: z.union([
      exactSuccessOutput({
        ...matchSectionCodesResponseSchema.omit({ sections: true }).shape,
        sections: z.array(compactMatchSectionSchema),
        note: z.string(),
      }),
      exactFailureOutputSchema,
    ]),
    full: z.union([
      exactSuccessOutput({
        ...matchSectionCodesResponseSchema.shape,
        note: z.string(),
      }),
      exactFailureOutputSchema,
    ]),
  },
  catalog_teacher_search: {
    default: paginatedTeacherDefaultMcpSchema,
    full: paginatedTeacherFullMcpSchema,
  },
  catalog_teacher_get: {
    default: exactSuccessOutput({
      found: z.boolean(),
      teacher: compactTeacherDetailSchema.nullable(),
    }),
    full: exactSuccessOutput({
      found: z.boolean(),
      teacher: teacherDetailSchema.nullable(),
    }),
  },
  catalog_schedule_list: {
    default: z.union([
      paginatedScheduleDefaultMcpSchema,
      exactFailureOutputSchema,
    ]),
    full: z.union([paginatedScheduleFullMcpSchema, exactFailureOutputSchema]),
  },
  catalog_section_schedule_list: {
    default: z.union([
      exactSuccessOutput({
        found: z.literal(true),
        section: compactSectionContextSchema,
        schedules: z.array(compactScopedScheduleSchema),
      }),
      exactFailureOutputSchema,
    ]),
    full: z.union([
      exactSuccessOutput({
        found: z.literal(true),
        section: sectionContextFullSchema,
        schedules: z.array(sectionScheduleWithContextSchema),
      }),
      exactFailureOutputSchema,
    ]),
  },
  workspace_schedule_list: {
    default: z.union([
      exactSuccessOutput({
        schedules: z.array(compactWorkspaceScheduleSchema),
      }),
      exactFailureOutputSchema,
    ]),
    full: z.union([
      exactSuccessOutput({ schedules: z.array(subscribedScheduleEntrySchema) }),
      exactFailureOutputSchema,
    ]),
  },
  catalog_section_exam_list: {
    default: z.union([
      exactSuccessOutput({
        found: z.literal(true),
        section: compactSectionContextSchema,
        exams: z.array(compactCatalogExamSchema),
      }),
      exactFailureOutputSchema,
    ]),
    full: z.union([
      exactSuccessOutput({
        found: z.literal(true),
        section: sectionContextFullSchema,
        exams: z.array(fullCatalogExamSchema),
      }),
      exactFailureOutputSchema,
    ]),
  },
  workspace_exam_list: {
    default: z.union([
      exactSuccessOutput({ exams: z.array(compactWorkspaceExamSchema) }),
      exactFailureOutputSchema,
    ]),
    full: z.union([
      exactSuccessOutput({ exams: z.array(subscribedExamSchema) }),
      exactFailureOutputSchema,
    ]),
  },
} satisfies Record<string, Record<"default" | "full", McpToolOutputSchema>>;

type AcademicModeToolName = keyof typeof academicModeOutputSchemas;

const courseDetailSectionMcpSchema = courseDetailSectionSchema.extend({
  semester: compactSemesterSchema.nullable(),
});
const courseDetailMcpSchema = courseDetailSchema.extend({
  sections: z.array(courseDetailSectionMcpSchema),
});
const sectionDetailMcpSchema = sectionDetailSchema.extend({
  semester: compactSemesterSchema.nullable(),
});
const teacherDetailSectionMcpSchema = teacherDetailSectionSchema.extend({
  semester: compactSemesterSchema.nullable(),
});
const teacherDetailMcpSchema = teacherDetailSchema.extend({
  sections: z.array(teacherDetailSectionMcpSchema),
});
const scheduleEntryMcpSchema = scheduleEntrySchema.extend({
  section: scheduleEntrySchema.shape.section.extend({
    semester: compactSemesterSchema.nullable(),
  }),
});
const subscribedScheduleEntryMcpSchema = subscribedScheduleEntrySchema.extend({
  section: subscribedScheduleEntrySchema.shape.section.extend({
    semester: compactSemesterSchema.nullable(),
  }),
});
const subscribedExamMcpSchema = subscribedExamSchema.extend({
  section: subscribedExamSchema.shape.section.extend({
    semester: compactSemesterSchema.nullable(),
  }),
});
const sectionCompactMcpSchema = sectionCompactSchema.extend({
  semester: compactSemesterSchema.nullable(),
});

const academicAdvertisedOutputSchemas: Record<
  AcademicModeToolName,
  McpToolOutputSchema
> = {
  catalog_course_search: objectOutputSchema({
    data: z.array(z.union([compactCourseSchema, courseSchema])),
    pagination: paginatedCourseResponseSchema.shape.pagination,
  }),
  catalog_course_get: objectOutputSchema({
    course: z.union([compactCourseSchema, courseDetailMcpSchema]).nullable(),
  }),
  catalog_section_search: objectOutputSchema({
    data: z.array(z.union([compactSectionSummarySchema, sectionSummarySchema])),
    pagination: paginatedSectionResponseSchema.shape.pagination,
  }),
  catalog_section_get: objectOutputSchema({
    section: z.union([compactSectionDetailSchema, sectionDetailMcpSchema]),
  }),
  catalog_section_match_preview: objectOutputSchema({
    ...matchSectionCodesResponseSchema.omit({ sections: true }).shape,
    sections: z.array(
      z.union([compactMatchSectionSchema, sectionCompactMcpSchema]),
    ),
    note: z.string(),
  }),
  catalog_teacher_search: objectOutputSchema({
    data: z.array(z.union([compactCatalogTeacherSchema, teacherListSchema])),
    pagination: paginatedTeacherResponseSchema.shape.pagination,
  }),
  catalog_teacher_get: objectOutputSchema({
    teacher: z
      .union([compactTeacherDetailSchema, teacherDetailMcpSchema])
      .nullable(),
  }),
  catalog_schedule_list: objectOutputSchema({
    data: z.array(
      z.union([compactPublicScheduleSchema, scheduleEntryMcpSchema]),
    ),
    pagination: paginatedScheduleResponseSchema.shape.pagination,
  }),
  catalog_section_schedule_list: objectOutputSchema({
    section: z.union([compactSectionContextSchema, sectionContextFullSchema]),
    schedules: z.array(
      z.union([compactScopedScheduleSchema, sectionScheduleWithContextSchema]),
    ),
  }),
  workspace_schedule_list: objectOutputSchema({
    schedules: z.array(
      z.union([
        compactWorkspaceScheduleSchema,
        subscribedScheduleEntryMcpSchema,
      ]),
    ),
  }),
  catalog_section_exam_list: objectOutputSchema({
    section: z.union([compactSectionContextSchema, sectionContextFullSchema]),
    exams: z.array(z.union([compactCatalogExamSchema, fullCatalogExamSchema])),
  }),
  workspace_exam_list: objectOutputSchema({
    exams: z.array(
      z.union([compactWorkspaceExamSchema, subscribedExamMcpSchema]),
    ),
  }),
};

function advertisedAcademicOutputSchema(name: AcademicModeToolName) {
  return academicAdvertisedOutputSchemas[name];
}

const paginatedSemesterMcpSchema = objectOutputSchema({
  data: collectionOutputSchema(compactSemesterSchema),
  pagination: paginatedSemesterResponseSchema.shape.pagination,
});

const todoListMcpSchema = objectOutputSchema({
  counts: todoCountsSchema,
  todos: collectionOutputSchema(compactTodoSchema),
});

const uploadListMcpSchema = objectOutputSchema({
  data: collectionOutputSchema(uploadSummarySchema),
  pagination: uploadsListResponseSchema.shape.pagination,
  meta: uploadsListResponseSchema.shape.meta,
});

function createMcpCommentNodeSchema(includeRenderedBody: boolean): z.ZodType {
  let schema: z.ZodType;
  schema = z.lazy(() =>
    z
      .object({
        id: z.string(),
        body: z.string(),
        ...(includeRenderedBody ? { renderedBody: z.string() } : {}),
        visibility: z.string(),
        status: z.string(),
        author: commentAuthorSummarySchema.nullable(),
        authorHidden: z.boolean(),
        isAnonymous: z.boolean(),
        isAuthor: z.boolean(),
        createdAt: dateTimeSchema,
        updatedAt: dateTimeSchema,
        parentId: z.string().nullable(),
        rootId: z.string().nullable(),
        replies: z.array(schema),
        attachments: z.array(commentAttachmentSummarySchema),
        reactions: z.array(commentReactionSummarySchema),
        canReact: z.boolean(),
        canReply: z.boolean(),
        canEdit: z.boolean(),
        canDelete: z.boolean(),
        canModerate: z.boolean(),
      })
      .strict(),
  );
  return schema;
}

const compactCommentNodeSchema = createMcpCommentNodeSchema(false);
const fullCommentNodeSchema = createMcpCommentNodeSchema(true);
const commentNodeMcpSchema = z.union([
  compactCommentNodeSchema,
  fullCommentNodeSchema,
]);

const compactDescriptionDetailSchema = descriptionDetailSchema
  .omit({ renderedHtml: true })
  .strict();
const descriptionDetailMcpSchema = z.union([
  compactDescriptionDetailSchema,
  descriptionDetailSchema.strict(),
]);

function commentListOutputSchema(commentSchema: z.ZodType) {
  return objectOutputSchema({
    found: z.boolean(),
    data: collectionOutputSchema(commentSchema),
    pagination: commentsListResponseSchema.shape.pagination,
    meta: commentsListResponseSchema.shape.meta,
  });
}

function commentThreadOutputSchema(commentSchema: z.ZodType) {
  return objectOutputSchema({
    thread: collectionOutputSchema(commentSchema),
    focusId: z.string(),
    hiddenCount: z.number().int().nonnegative(),
    viewer: z.unknown(),
    target: z.unknown(),
  });
}

function descriptionOutputSchema(descriptionSchema: z.ZodType) {
  return objectOutputSchema({
    target: z.unknown(),
    description: descriptionSchema,
    history: collectionOutputSchema(descriptionHistoryEntrySchema),
    viewer: viewerContextSchema,
  });
}

function descriptionUpsertOutputSchema(descriptionSchema: z.ZodType) {
  return objectOutputSchema({
    id: z.string(),
    updated: z.boolean(),
    target: z.unknown(),
    description: descriptionSchema,
    history: collectionOutputSchema(descriptionHistoryEntrySchema),
    viewer: viewerContextSchema,
  });
}

const commentListMcpSchema = commentListOutputSchema(commentNodeMcpSchema);
const commentThreadMcpSchema = commentThreadOutputSchema(commentNodeMcpSchema);
const descriptionMcpSchema = descriptionOutputSchema(
  descriptionDetailMcpSchema,
);
const descriptionUpsertMcpSchema = descriptionUpsertOutputSchema(
  descriptionDetailMcpSchema,
);

const MARKDOWN_MODE_OUTPUT_SCHEMAS = {
  community_comment_list: {
    default: commentListOutputSchema(compactCommentNodeSchema),
    full: commentListOutputSchema(fullCommentNodeSchema),
  },
  community_comment_get: {
    default: commentThreadOutputSchema(compactCommentNodeSchema),
    full: commentThreadOutputSchema(fullCommentNodeSchema),
  },
  community_description_get: {
    default: descriptionOutputSchema(compactDescriptionDetailSchema),
    full: descriptionOutputSchema(descriptionDetailSchema.strict()),
  },
  community_description_set: {
    default: descriptionUpsertOutputSchema(compactDescriptionDetailSchema),
    full: descriptionUpsertOutputSchema(descriptionDetailSchema.strict()),
  },
} satisfies Record<string, Record<"default" | "full", McpToolOutputSchema>>;

// Production startup asserts that every registered application tool has an
// explicit entry. The fallback exists only for isolated SDK/test registrations.
const TOOL_OUTPUT_SCHEMAS: Record<string, McpToolOutputSchema> = {
  graphql_operation_run: objectOutputSchema({
    operationId: z.string(),
    operationName: z.string(),
    operationType: z.enum(["mutation", "query"]),
    data: z.record(z.string(), z.unknown()).nullable(),
    errors: z.array(
      z
        .object({
          message: z.string(),
          locations: z
            .array(
              z.object({
                line: z.number().int().positive(),
                column: z.number().int().positive(),
              }),
            )
            .optional(),
          path: z.array(z.union([z.string(), z.number().int()])).optional(),
          extensions: z.record(z.string(), z.unknown()).optional(),
        })
        .strict(),
    ),
    requiredScopes: z.array(z.string()),
  }),
  account_profile_get: objectOutputSchemaFromApi(meResponseSchema),
  community_user_get: objectOutputSchema({
    user: compactUserSchema,
    sectionCount: z.number().int().nonnegative(),
    weeks: z.unknown(),
    totalContributions: z.number().int().nonnegative(),
  }),
  workspace_todo_list: todoListMcpSchema,
  workspace_todo_create: objectOutputSchema({
    success: z.boolean(),
    id: z.string(),
  }),
  workspace_todo_update: objectOutputSchema({
    success: z.boolean(),
    todo: compactTodoSchema,
  }),
  workspace_todo_delete: objectOutputSchemaFromApi(successResponseSchema),

  workspace_homework_list: objectOutputSchema({
    homeworks: collectionOutputSchema(compactHomeworkSchema),
  }),
  workspace_homework_completion_set: topLevelOutputSchema(["completion"]),
  community_section_homework_list: objectOutputSchema({
    section: compactSectionSchema,
    homeworks: collectionOutputSchema(compactHomeworkSchema),
  }),
  community_section_homework_create: objectOutputSchema({
    id: z.string(),
    homework: compactHomeworkSchema,
    reason: z.string().nullable(),
  }),
  community_section_homework_update: objectOutputSchema({
    homework: compactHomeworkSchema,
    reason: z.string().nullable(),
  }),
  community_section_homework_delete: topLevelOutputSchema([
    "deletedId",
    "alreadyDeleted",
    "reason",
  ]),

  workspace_calendar_feed_get: objectOutputSchema({
    subscription: compactCalendarSubscriptionSchema.nullable(),
  }),
  workspace_subscription_list: objectOutputSchema({
    sections: collectionOutputSchema(compactSectionSchema),
    note: z.string(),
  }),
  workspace_subscription_add: objectOutputSchema({
    action: z.string(),
    sectionJwId: z.number().int(),
    subscription: compactCalendarSubscriptionSchema.nullable(),
  }),
  workspace_subscription_remove: objectOutputSchema({
    action: z.string(),
    sectionJwId: z.number().int(),
    subscription: compactCalendarSubscriptionSchema.nullable(),
  }),
  workspace_subscription_import: objectOutputSchema({
    semester: compactSemesterSchema,
    matchedCodes: collectionOutputSchema(z.string()),
    unmatchedCodes: collectionOutputSchema(z.string()),
    addedCount: z.number().int().nonnegative(),
    alreadySubscribedCount: z.number().int().nonnegative(),
    subscription: compactCalendarSubscriptionSchema.nullable(),
  }),
  catalog_section_calendar_feed_get: objectOutputSchema({
    section: compactSectionSchema.nullable(),
    calendarPath: z.string(),
    calendarUrl: z.string(),
  }),

  workspace_calendar_event_list: topLevelOutputSchema(["events"]),
  workspace_calendar_timeline_get: topLevelOutputSchema([
    "range",
    "total",
    "events",
  ]),

  community_comment_list: commentListMcpSchema,
  community_comment_get: commentThreadMcpSchema,
  community_comment_create: objectOutputSchema({
    success: z.boolean(),
    id: z.string(),
  }),
  community_comment_update: topLevelOutputSchema(["comment"]),
  community_comment_delete: objectOutputSchemaFromApi(successResponseSchema),
  community_comment_reaction_add: objectOutputSchema({
    success: z.boolean(),
    changed: z.boolean(),
  }),
  community_comment_reaction_remove: objectOutputSchema({
    success: z.boolean(),
    changed: z.boolean(),
  }),

  community_description_get: descriptionMcpSchema,
  community_description_set: descriptionUpsertMcpSchema,

  workspace_upload_list: uploadListMcpSchema,
  workspace_upload_rename: objectOutputSchema({
    ...uploadRenameResponseSchema.shape,
    success: z.boolean(),
    reason: z.string().nullable(),
  }),
  workspace_upload_delete: objectOutputSchema({
    ...uploadDeleteResponseSchema.shape,
    success: z.boolean(),
    reason: z.string().nullable(),
  }),

  workspace_snapshot_get: topLevelOutputSchema([
    "user",
    "currentSemester",
    "subscriptions",
    "nextClass",
    "upcomingDeadlines",
    "upcomingEvents",
    "todos",
    "bus",
  ]),
  catalog_link_list: topLevelOutputSchema([
    "query",
    "total",
    "returned",
    "links",
  ]),
  workspace_link_pin_list: topLevelOutputSchema([
    "pinnedSlugs",
    "maxPinnedLinks",
  ]),
  workspace_link_pin_set: topLevelOutputSchema([
    "action",
    "slug",
    "pinnedSlugs",
    "maxPinnedLinks",
  ]),
  workspace_deadline_list: topLevelOutputSchema(["total", "deadlines"]),
  workspace_overview_get: topLevelOutputSchema(["user", "overview", "samples"]),
  workspace_schedule_next: topLevelOutputSchema([
    "nextClass",
    "currentSemester",
  ]),

  catalog_bus_timetable_get: objectOutputSchema({
    locale: z.string(),
    fetchedAt: dateTimeSchema,
    version: z.unknown(),
    counts: z.unknown(),
    campuses: collectionOutputSchema(compactCampusSchema),
    routes: collectionOutputSchema(compactBusRouteSchema),
    trips: collectionOutputSchema(compactBusTripSchema),
    availableVersions: collectionOutputSchema(z.unknown()),
    preferences: z.unknown(),
    nextDepartures: collectionOutputSchema(compactBusTripSchema),
    nextDeparturesMessage: z.string().nullable(),
    notice: z.unknown(),
    hasData: z.boolean(),
  }),
  catalog_bus_route_list: objectOutputSchema({
    locale: z.string(),
    version: z.unknown(),
    campuses: collectionOutputSchema(compactCampusSchema),
    routes: collectionOutputSchema(compactBusRouteSchema),
    notice: z.unknown(),
  }),
  catalog_bus_route_get: objectOutputSchema({
    routeId: z.number().int(),
    route: compactBusRouteSchema,
    weekday: collectionOutputSchema(z.unknown()),
    weekend: collectionOutputSchema(z.unknown()),
    alternateRoutes: collectionOutputSchema(compactBusRouteSchema),
    hasData: z.boolean(),
  }),
  workspace_bus_preferences_get: topLevelOutputSchema(["preference"]),
  workspace_bus_preferences_set: topLevelOutputSchema(["preference"]),
  catalog_bus_route_search: objectOutputSchema({
    originCampus: compactCampusSchema.nullable(),
    destinationCampus: compactCampusSchema.nullable(),
    total: z.number().int().nonnegative(),
    routes: collectionOutputSchema(compactBusRouteSchema),
    hasData: z.boolean(),
  }),
  catalog_bus_departure_next: objectOutputSchema({
    atTime: dateTimeSchema,
    dayType: z.enum(["weekday", "weekend"]),
    totalRoutes: z.number().int().nonnegative(),
    departures: collectionOutputSchema(compactBusTripSchema),
    nextAvailableDeparture: compactBusTripSchema.nullable(),
    originCampus: compactCampusSchema.nullable(),
    destinationCampus: compactCampusSchema.nullable(),
    hasData: z.boolean(),
    message: z.string().nullable(),
  }),

  catalog_course_search: advertisedAcademicOutputSchema(
    "catalog_course_search",
  ),
  catalog_course_get: advertisedAcademicOutputSchema("catalog_course_get"),
  catalog_semester_list: paginatedSemesterMcpSchema,
  catalog_semester_current: objectOutputSchema({
    semester: compactSemesterSchema.nullable(),
  }),

  catalog_section_get: advertisedAcademicOutputSchema("catalog_section_get"),
  catalog_section_search: advertisedAcademicOutputSchema(
    "catalog_section_search",
  ),
  catalog_section_match_preview: advertisedAcademicOutputSchema(
    "catalog_section_match_preview",
  ),

  catalog_teacher_search: advertisedAcademicOutputSchema(
    "catalog_teacher_search",
  ),
  catalog_teacher_get: advertisedAcademicOutputSchema("catalog_teacher_get"),

  catalog_schedule_list: advertisedAcademicOutputSchema(
    "catalog_schedule_list",
  ),
  catalog_section_schedule_list: advertisedAcademicOutputSchema(
    "catalog_section_schedule_list",
  ),
  workspace_schedule_list: advertisedAcademicOutputSchema(
    "workspace_schedule_list",
  ),

  catalog_section_exam_list: advertisedAcademicOutputSchema(
    "catalog_section_exam_list",
  ),
  workspace_exam_list: advertisedAcademicOutputSchema("workspace_exam_list"),
};

export function getMcpToolOutputSchema(name: string): McpToolOutputSchema {
  return TOOL_OUTPUT_SCHEMAS[name] ?? STRUCTURED_CONTENT_OUTPUT_SCHEMA;
}

export function getMcpToolOutputSchemaForMode(
  name: string,
  mode: "default" | "full",
): McpToolOutputSchema {
  if (Object.hasOwn(academicModeOutputSchemas, name)) {
    return academicModeOutputSchemas[name as AcademicModeToolName][mode];
  }
  return getMcpToolOutputSchema(name);
}

export function getMarkdownMcpToolOutputSchemaForMode(
  name: keyof typeof MARKDOWN_MODE_OUTPUT_SCHEMAS,
  mode: "default" | "full",
): McpToolOutputSchema {
  return MARKDOWN_MODE_OUTPUT_SCHEMAS[name][mode];
}

export function hasMcpToolOutputSchema(name: string): boolean {
  return Object.hasOwn(TOOL_OUTPUT_SCHEMAS, name);
}

export function getMcpToolOutputSchemaNames(): string[] {
  return Object.keys(TOOL_OUTPUT_SCHEMAS);
}
