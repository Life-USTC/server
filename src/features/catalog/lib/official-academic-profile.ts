import * as z from "zod";

export const officialAcademicProfileSchema = z.object({
  credits: z.number().nullable(),
  hours: z.number().nullable(),
  department: z.string().nullable(),
  language: z.string().nullable(),
  prerequisites: z.string().nullable(),
  assessment: z.string().nullable(),
  grading: z.string().nullable(),
  description: z.object({
    zh: z.string().nullable(),
    en: z.string().nullable(),
  }),
  textbook: z.string().nullable(),
  textbooks: z.array(
    z.object({
      nameZh: z.string().nullable(),
      nameEn: z.string().nullable(),
      author: z.string().nullable(),
      isbn: z.string().nullable(),
    }),
  ),
  references: z.string().nullable(),
  syllabus: z.object({
    zh: z.array(
      z.object({ title: z.string().nullable(), content: z.string() }),
    ),
    en: z.array(
      z.object({ title: z.string().nullable(), content: z.string() }),
    ),
    topics: z.array(
      z.object({ name: z.string(), hours: z.number().nullable() }),
    ),
  }),
});

export type OfficialAcademicProfile = z.output<
  typeof officialAcademicProfileSchema
>;
