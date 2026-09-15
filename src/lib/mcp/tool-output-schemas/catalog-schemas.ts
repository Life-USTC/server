import { z } from "zod";
import {
  courseBaseSchema,
  courseSchema,
} from "@/lib/api/schemas/academic-course-response-schemas";
import {
  examBatchSchema,
  examSchema,
} from "@/lib/api/schemas/academic-exam-response-schemas";
import {
  paginatedCourseResponseSchema,
  paginatedSectionResponseSchema,
  paginatedSemesterResponseSchema,
  paginatedTeacherResponseSchema,
} from "@/lib/api/schemas/academic-paginated-response-schemas";
import { sectionBaseSchema } from "@/lib/api/schemas/academic-section-base-response-schemas";
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
  teacherListSchema,
  teacherPublicIdentitySchema,
  teacherTitleSchema,
} from "@/lib/api/schemas/academic-teacher-response-schemas";
import {
  paginatedScheduleResponseSchema,
  scheduleBuildingSchema,
  scheduleEntrySchema,
  scheduleRoomSchema,
  scheduleTeacherSchema,
} from "@/lib/api/schemas/schedule-response-schema-core";

import {
  collectionOutputSchema,
  compactCampusSchema,
  compactCourseReferenceSchema,
  compactCourseSchema,
  compactDepartmentSchema,
  compactSemesterReferenceSchema,
  compactSemesterSchema,
  exactFailureOutputSchema,
  exactSuccessOutput,
  objectOutputSchema,
} from "./builders";

export const compactTeacherTitleSchema = teacherTitleSchema
  .pick({
    id: true,
    nameCn: true,
    nameEn: true,
    namePrimary: true,
    nameSecondary: true,
  })
  .strict();

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

export const compactTeacherReferenceSchema =
  compactScheduleTeacherSchema.extend({
    teacherTitle: compactTeacherTitleSchema.nullable(),
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

export const compactPublicScheduleSchema = compactScheduleSchema.extend({
  section: compactScheduleSectionSchema,
});

export const compactScopedScheduleSchema = compactScheduleSchema.omit({
  section: true,
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
export const sectionCompactMcpSchema = sectionCompactSchema.extend({
  semester: compactSemesterSchema.nullable(),
});

export const paginatedSemesterMcpSchema = objectOutputSchema({
  data: collectionOutputSchema(compactSemesterSchema),
  pagination: paginatedSemesterResponseSchema.shape.pagination,
});
