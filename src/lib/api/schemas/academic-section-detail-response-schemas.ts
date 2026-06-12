import * as z from "zod";
import {
  courseSchema,
  examModeSchema,
  teachLanguageSchema,
} from "./academic-course-response-schemas";
import {
  campusSchema,
  roomTypeSchema,
} from "./academic-location-response-schemas";
import {
  adminClassSchema,
  sectionBaseSchema,
  semesterSchema,
} from "./academic-section-base-response-schemas";
import {
  departmentSchema,
  teacherWithDepartmentTitleSchema,
} from "./academic-teacher-response-schemas";

export {
  examBatchSchema,
  examRoomSchema,
  examSchema,
} from "./academic-exam-response-schemas";

import { examSchema } from "./academic-exam-response-schemas";
import {
  scheduleBaseSchema,
  scheduleGroupSchema,
} from "./academic-schedule-response-schemas";

export {
  scheduleBaseSchema,
  scheduleGroupSchema,
} from "./academic-schedule-response-schemas";

import { teacherAssignmentSchema } from "./academic-teacher-assignment-response-schemas";

export {
  teacherAssignmentBaseSchema,
  teacherAssignmentSchema,
} from "./academic-teacher-assignment-response-schemas";

export const sectionDetailSchema = sectionBaseSchema.extend({
  course: courseSchema,
  semester: semesterSchema.nullable(),
  campus: campusSchema.nullable(),
  openDepartment: departmentSchema.nullable(),
  examMode: examModeSchema.nullable(),
  teachLanguage: teachLanguageSchema.nullable(),
  roomType: roomTypeSchema.nullable(),
  schedules: z.array(scheduleBaseSchema),
  scheduleGroups: z.array(scheduleGroupSchema),
  teachers: z.array(teacherWithDepartmentTitleSchema),
  teacherAssignments: z.array(teacherAssignmentSchema),
  exams: z.array(examSchema),
  adminClasses: z.array(adminClassSchema),
});
