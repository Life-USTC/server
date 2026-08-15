import * as z from "zod";

export const localizedNameFields = {
  namePrimary: z.string(),
  nameSecondary: z.string().nullable(),
};

export const courseCategorySchema = z.object({
  id: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  ...localizedNameFields,
});

export const courseClassifySchema = z.object({
  id: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  ...localizedNameFields,
});

export const courseGradationSchema = z.object({
  id: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  ...localizedNameFields,
});

export const courseTypeSchema = z.object({
  id: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  ...localizedNameFields,
});

export const classTypeSchema = z.object({
  id: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  ...localizedNameFields,
});

export const educationLevelSchema = z.object({
  id: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  ...localizedNameFields,
});

export const examModeSchema = z.object({
  id: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  ...localizedNameFields,
});

export const teachLanguageSchema = z.object({
  id: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  ...localizedNameFields,
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
  ...localizedNameFields,
});

export const courseSchema = courseBaseSchema.extend({
  category: courseCategorySchema.nullable(),
  classType: classTypeSchema.nullable(),
  classify: courseClassifySchema.nullable(),
  educationLevel: educationLevelSchema.nullable(),
  gradation: courseGradationSchema.nullable(),
  type: courseTypeSchema.nullable(),
});

export const localizedCourseBaseSchema = courseBaseSchema;

export type CourseDto = z.output<typeof courseSchema>;
