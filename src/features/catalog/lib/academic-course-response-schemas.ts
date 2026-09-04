/** Catalog-owned course/category OpenAPI response DTO schemas. */
import * as z from "zod";

export const localizedNameFields = {
  namePrimary: z.string(),
  nameSecondary: z.string().nullable(),
};

export const courseCategorySchema = z.strictObject({
  id: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  ...localizedNameFields,
});

export const courseClassifySchema = z.strictObject({
  id: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  ...localizedNameFields,
});

export const courseGradationSchema = z.strictObject({
  id: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  ...localizedNameFields,
});

export const courseTypeSchema = z.strictObject({
  id: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  ...localizedNameFields,
});

export const classTypeSchema = z.strictObject({
  id: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  ...localizedNameFields,
});

export const educationLevelSchema = z.strictObject({
  id: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  ...localizedNameFields,
});

export const examModeSchema = z.strictObject({
  id: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  ...localizedNameFields,
});

export const teachLanguageSchema = z.strictObject({
  id: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  ...localizedNameFields,
});

export const courseBaseSchema = z.strictObject({
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
