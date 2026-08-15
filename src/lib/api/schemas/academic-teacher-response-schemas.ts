import * as z from "zod";
import { localizedNameFields } from "./academic-course-response-schemas";

export const departmentSchema = z.strictObject({
  id: z.number().int(),
  jwId: z.number().int().nullable(),
  code: z.string(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  isCollege: z.boolean().nullable(),
  ...localizedNameFields,
});

export const departmentSummarySchema = departmentSchema.omit({ jwId: true });

export const teacherTitleSchema = z.strictObject({
  id: z.number().int(),
  jwId: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  code: z.string(),
  enabled: z.boolean().nullable(),
  ...localizedNameFields,
});

export const teacherLessonTypeSchema = z.strictObject({
  id: z.number().int(),
  jwId: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  code: z.string(),
  role: z.string().nullable(),
  enabled: z.boolean().nullable(),
});

export const teacherSchema = z.strictObject({
  id: z.number().int(),
  jwId: z.number().int(),
  personId: z.number().int().nullable(),
  code: z.string().nullable(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  email: z.string().nullable(),
  telephone: z.string().nullable(),
  mobile: z.string().nullable(),
  address: z.string().nullable(),
  departmentId: z.number().int().nullable(),
  teacherTitleId: z.number().int().nullable(),
  ...localizedNameFields,
});

export const teacherPublicIdentitySchema = z.strictObject({
  id: z.number().int(),
  jwId: z.number().int(),
  personId: z.number().int().nullable(),
  code: z.string().nullable(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  namePrimary: z.string(),
  nameSecondary: z.string().nullable(),
});

export const teacherPublicReferenceSchema = teacherPublicIdentitySchema.extend({
  department: departmentSummarySchema.nullable(),
  teacherTitle: teacherTitleSchema.nullable(),
});

export const teacherWithDepartmentTitleSchema = teacherSchema.extend({
  department: departmentSummarySchema.nullable(),
  teacherTitle: teacherTitleSchema.nullable(),
});

export const teacherListSchema = teacherWithDepartmentTitleSchema.extend({
  _count: z.strictObject({ sections: z.number().int() }),
});

export type TeacherListDto = z.output<typeof teacherListSchema>;
