import * as z from "zod";
import {
  courseSchema,
  examModeSchema,
  teachLanguageSchema,
} from "./academic-course-response-schemas";
import { campusSchema } from "./academic-location-response-schemas";
import {
  adminClassSchema,
  sectionBaseSchema,
  semesterSchema,
} from "./academic-section-base-response-schemas";
import {
  departmentSchema,
  teacherSchema,
  teacherWithDepartmentTitleSchema,
} from "./academic-teacher-response-schemas";

const courseSummarySchema = z.object({
  id: z.number().int(),
  jwId: z.number().int(),
  code: z.string(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
});

const campusSummarySchema = z.object({
  id: z.number().int(),
  jwId: z.number().int().nullable(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  code: z.string().nullable(),
});

const semesterSummarySchema = z.object({
  id: z.number().int(),
  jwId: z.number().int(),
  nameCn: z.string(),
  code: z.string(),
});

const teacherSummarySchema = z.object({
  id: z.number().int(),
  personId: z.number().int().nullable(),
  teacherId: z.number().int().nullable(),
  code: z.string().nullable(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
});

export const sectionSummarySchema = z.object({
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
  teachers: z.array(teacherSummarySchema),
});

export const sectionCompactSchema = sectionBaseSchema.extend({
  course: courseSchema,
  semester: semesterSchema.nullable(),
  campus: campusSchema.nullable(),
  openDepartment: departmentSchema.nullable(),
  teachers: z.array(teacherSchema),
});

export const sectionListSchema = sectionBaseSchema.extend({
  course: courseSchema,
  semester: semesterSchema.nullable(),
  campus: campusSchema.nullable(),
  openDepartment: departmentSchema.nullable(),
  examMode: examModeSchema.nullable(),
  teachLanguage: teachLanguageSchema.nullable(),
  teachers: z.array(teacherSchema),
  adminClasses: z.array(adminClassSchema),
});

export const courseDetailSectionSchema = sectionBaseSchema.extend({
  semester: semesterSchema.nullable(),
  campus: campusSchema.nullable(),
  teachers: z.array(teacherSchema),
});

export const courseDetailSchema = courseSchema.extend({
  sections: z.array(courseDetailSectionSchema),
});

export const teacherDetailSectionSchema = sectionBaseSchema.extend({
  course: courseSchema,
  semester: semesterSchema.nullable(),
});

export const teacherDetailSchema = teacherWithDepartmentTitleSchema.extend({
  sections: z.array(teacherDetailSectionSchema),
  _count: z.object({ sections: z.number().int() }),
});
