/** Catalog-owned section-list and detail OpenAPI response DTO schemas. */
import * as z from "zod";
import { campusSchema } from "@/lib/api/schemas/academic-location-response-schemas";
import {
  adminClassSchema,
  sectionBaseSchema,
  semesterSchema,
} from "@/lib/api/schemas/academic-section-base-response-schemas";
import {
  courseSchema,
  examModeSchema,
  teachLanguageSchema,
} from "./academic-course-response-schemas";
import {
  departmentSchema,
  teacherPublicIdentitySchema,
  teacherWithDepartmentTitleSchema,
} from "./academic-teacher-response-schemas";

const localizedNameFields = {
  namePrimary: z.string(),
  nameSecondary: z.string().nullable(),
};

const localizedCourseSchema = courseSchema.extend(localizedNameFields);
const localizedCampusSchema = campusSchema.extend(localizedNameFields);
const localizedDepartmentSchema = departmentSchema;
const localizedTeacherSchema = teacherPublicIdentitySchema;

const courseSummarySchema = z.strictObject({
  id: z.number().int(),
  jwId: z.number().int(),
  code: z.string(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  ...localizedNameFields,
});

const campusSummarySchema = z.strictObject({
  id: z.number().int(),
  jwId: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  code: z.string().nullable(),
  ...localizedNameFields,
});

const semesterSummarySchema = z.strictObject({
  id: z.number().int(),
  jwId: z.number().int(),
  nameCn: z.string(),
  code: z.string(),
});

const teacherSummarySchema = z.strictObject({
  id: z.number().int(),
  jwId: z.number().int(),
  personId: z.number().int().nullable(),
  code: z.string().nullable(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
});

export const sectionSummarySchema = z.strictObject({
  id: z.number().int(),
  jwId: z.number().int(),
  code: z.string(),
  credits: z.number().nullable(),
  stdCount: z.number().int().nullable(),
  limitCount: z.number().int().nullable(),
  courseId: z.number().int(),
  semesterId: z.number().int().nullable(),
  campusId: z.number().int().nullable(),
  openDepartmentId: z.number().int().nullable(),
  course: courseSummarySchema,
  semester: semesterSummarySchema.nullable(),
  campus: campusSummarySchema.nullable(),
  teachers: z.array(teacherSummarySchema.extend(localizedNameFields)),
});

export const sectionPublicContextSchema = z.strictObject({
  id: z.number().int(),
  jwId: z.number().int(),
  code: z.string(),
  course: z.strictObject({
    jwId: z.number().int(),
    code: z.string(),
    nameCn: z.string(),
    nameEn: z.string().nullable(),
    ...localizedNameFields,
  }),
  semester: z
    .strictObject({
      jwId: z.number().int(),
      code: z.string(),
      nameCn: z.string(),
    })
    .nullable(),
});

export const sectionCompactSchema = sectionBaseSchema.extend({
  course: localizedCourseSchema,
  semester: semesterSchema.nullable(),
  campus: localizedCampusSchema.nullable(),
  openDepartment: localizedDepartmentSchema.nullable(),
  teachers: z.array(localizedTeacherSchema),
});

export const sectionListSchema = sectionBaseSchema.extend({
  course: courseSchema,
  semester: semesterSchema.nullable(),
  campus: campusSchema.nullable(),
  openDepartment: departmentSchema.nullable(),
  examMode: examModeSchema.nullable(),
  teachLanguage: teachLanguageSchema.nullable(),
  teachers: z.array(teacherPublicIdentitySchema),
  adminClasses: z.array(adminClassSchema),
});

export const courseDetailSectionSchema = sectionBaseSchema.extend({
  semester: semesterSchema.nullable(),
  campus: campusSchema.nullable(),
  teachers: z.array(teacherPublicIdentitySchema),
});

export const courseDetailSchema = courseSchema.extend({
  sections: z.array(courseDetailSectionSchema),
  _count: z.strictObject({ sections: z.number().int() }),
});

export const teacherDetailSectionSchema = sectionBaseSchema.extend({
  course: courseSchema,
  semester: semesterSchema.nullable(),
});

export const teacherDetailSchema = teacherWithDepartmentTitleSchema.extend({
  sections: z.array(teacherDetailSectionSchema),
  _count: z.strictObject({ sections: z.number().int() }),
});

export type SectionSummaryDto = z.output<typeof sectionSummarySchema>;
export type SectionPublicContextDto = z.output<
  typeof sectionPublicContextSchema
>;
export type SectionCompactDto = z.output<typeof sectionCompactSchema>;
export type CourseDetailDto = z.output<typeof courseDetailSchema>;
export type TeacherDetailDto = z.output<typeof teacherDetailSchema>;
