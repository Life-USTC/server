import * as z from "zod";

export const departmentSchema = z.object({
  id: z.number().int(),
  code: z.string(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  isCollege: z.boolean().nullable(),
});

export const teacherTitleSchema = z.object({
  id: z.number().int(),
  jwId: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  code: z.string(),
  enabled: z.boolean().nullable(),
});

export const teacherLessonTypeSchema = z.object({
  id: z.number().int(),
  jwId: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  code: z.string(),
  role: z.string().nullable(),
  enabled: z.boolean().nullable(),
});

export const teacherSchema = z.object({
  id: z.number().int(),
  personId: z.number().int().nullable(),
  teacherId: z.number().int().nullable(),
  code: z.string().nullable(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  age: z.number().int().nullable(),
  email: z.string().nullable(),
  telephone: z.string().nullable(),
  mobile: z.string().nullable(),
  address: z.string().nullable(),
  postcode: z.string().nullable(),
  qq: z.string().nullable(),
  wechat: z.string().nullable(),
  departmentId: z.number().int().nullable(),
  teacherTitleId: z.number().int().nullable(),
});

export const teacherWithDepartmentTitleSchema = teacherSchema.extend({
  department: departmentSchema.nullable(),
  teacherTitle: teacherTitleSchema.nullable(),
});

export const teacherListSchema = teacherWithDepartmentTitleSchema.extend({
  _count: z.object({ sections: z.number().int() }),
});
