import * as z from "zod";
import {
  teacherLessonTypeSchema,
  teacherSchema,
} from "./academic-teacher-response-schemas";

export const teacherAssignmentBaseSchema = z.object({
  id: z.number().int(),
  teacherId: z.number().int(),
  sectionId: z.number().int(),
  role: z.string().nullable(),
  period: z.number().int().nullable(),
  weekIndices: z.array(z.number().int()).nullable(),
  weekIndicesMsg: z.string().nullable(),
  teacherLessonTypeId: z.number().int().nullable(),
});

export const teacherAssignmentSchema = teacherAssignmentBaseSchema.extend({
  teacher: teacherSchema,
  teacherLessonType: teacherLessonTypeSchema.nullable(),
});
