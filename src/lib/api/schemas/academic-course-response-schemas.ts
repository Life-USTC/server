import * as z from "zod";

const localizedNameFields = {
  namePrimary: z.string(),
  nameSecondary: z.string().nullable(),
};

export const courseCategorySchema = z.object({
  id: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
});

export const courseClassifySchema = z.object({
  id: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
});

export const courseGradationSchema = z.object({
  id: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
});

export const courseTypeSchema = z.object({
  id: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
});

export const classTypeSchema = z.object({
  id: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
});

export const educationLevelSchema = z.object({
  id: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
});

export const examModeSchema = z.object({
  id: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
});

export const teachLanguageSchema = z.object({
  id: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
});

export const courseBaseSchema = z.object({
  id: z.number().int(),
  jwId: z.number().int(),
  code: z.string(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  categoryId: z.number().int().nullable(),
  classTypeId: z.number().int().nullable(),
  classifyId: z.number().int().nullable(),
  educationLevelId: z.number().int().nullable(),
  gradationId: z.number().int().nullable(),
  typeId: z.number().int().nullable(),
});

export const courseSchema = courseBaseSchema.extend({
  category: courseCategorySchema.nullable(),
  classType: classTypeSchema.nullable(),
  classify: courseClassifySchema.nullable(),
  educationLevel: educationLevelSchema.nullable(),
  gradation: courseGradationSchema.nullable(),
  type: courseTypeSchema.nullable(),
});

export const localizedCourseBaseSchema =
  courseBaseSchema.extend(localizedNameFields);
