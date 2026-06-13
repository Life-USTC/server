import { courseSchema } from "./academic-course-response-schemas";
import {
  sectionSummarySchema,
  semesterSchema,
} from "./academic-section-response-schemas";
import { teacherListSchema } from "./academic-teacher-response-schemas";
import { createPaginatedSchema } from "./response-schema-primitives";

export const paginatedCourseResponseSchema =
  createPaginatedSchema(courseSchema);
export const paginatedSectionResponseSchema =
  createPaginatedSchema(sectionSummarySchema);
export const paginatedTeacherResponseSchema =
  createPaginatedSchema(teacherListSchema);
export const paginatedSemesterResponseSchema =
  createPaginatedSchema(semesterSchema);
