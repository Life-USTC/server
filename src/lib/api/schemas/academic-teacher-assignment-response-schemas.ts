import * as z from "zod";
import {
  teacherLessonTypeSchema,
  teacherTitleSchema,
} from "./academic-teacher-response-schemas";

export const teacherAssignmentBaseSchema = z.strictObject({
  id: z.number().int(),
  teacherId: z.number().int(),
  sectionId: z.number().int(),
  role: z.string().nullable(),
  period: z.number().nullable(),
  weekIndices: z.array(z.number().int()).nullable(),
  weekIndicesMsg: z.string().nullable(),
  teacherLessonTypeId: z.number().int().nullable(),
  teacherTitleId: z.number().int().nullable(),
});

export const teacherAssignmentSchema = teacherAssignmentBaseSchema.extend({
  teacherLessonType: teacherLessonTypeSchema.nullable(),
  teacherTitle: teacherTitleSchema.nullable(),
});
