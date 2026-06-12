import * as z from "zod";
import {
  classTypeSchema,
  courseCategorySchema,
  courseClassifySchema,
  courseGradationSchema,
  courseTypeSchema,
  educationLevelSchema,
  examModeSchema,
  teachLanguageSchema,
} from "./academic-course-response-schemas";
import {
  buildingSchema,
  campusSchema,
} from "./academic-location-response-schemas";

export const metadataResponseSchema = z.object({
  educationLevels: z.array(educationLevelSchema),
  courseCategories: z.array(courseCategorySchema),
  courseClassifies: z.array(courseClassifySchema),
  classTypes: z.array(classTypeSchema),
  courseTypes: z.array(courseTypeSchema),
  courseGradations: z.array(courseGradationSchema),
  examModes: z.array(examModeSchema),
  teachLanguages: z.array(teachLanguageSchema),
  campuses: z.array(
    campusSchema.extend({ buildings: z.array(buildingSchema) }),
  ),
});
