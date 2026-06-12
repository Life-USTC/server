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
