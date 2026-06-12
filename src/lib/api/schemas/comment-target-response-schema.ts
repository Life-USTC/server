import * as z from "zod";

export const commentListTargetSchema = z.object({
  type: z.string(),
  targetId: z.union([z.number().int(), z.string(), z.null()]),
  sectionId: z.number().int().nullable(),
  teacherId: z.number().int().nullable(),
  sectionTeacherId: z.number().int().nullable(),
  homeworkId: z.string().nullable(),
});

export const commentThreadTargetSchema = z.object({
  sectionId: z.number().int().nullable(),
  courseId: z.number().int().nullable(),
  teacherId: z.number().int().nullable(),
  sectionTeacherId: z.number().int().nullable(),
  sectionTeacherSectionId: z.number().int().nullable(),
  sectionTeacherTeacherId: z.number().int().nullable(),
  sectionTeacherSectionJwId: z.number().int().nullable(),
  sectionTeacherSectionCode: z.string().nullable(),
  sectionTeacherTeacherName: z.string().nullable(),
  sectionTeacherCourseJwId: z.number().int().nullable(),
  sectionTeacherCourseName: z.string().nullable(),
  homeworkId: z.string().nullable(),
  homeworkTitle: z.string().nullable(),
  homeworkSectionJwId: z.number().int().nullable(),
  homeworkSectionCode: z.string().nullable(),
  sectionJwId: z.number().int().nullable(),
  sectionCode: z.string().nullable(),
  courseJwId: z.number().int().nullable(),
  courseName: z.string().nullable(),
  teacherName: z.string().nullable(),
});
