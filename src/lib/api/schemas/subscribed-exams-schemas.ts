import { z } from "zod";
import { APP_LOCALES } from "@/i18n/config";
import { parseRequiredDateInput } from "@/lib/time/date-time-from-hhmm";
import { formatShanghaiDate } from "@/lib/time/shanghai-format";
import { subscribedExamSchema } from "./academic-exam-response-schemas";
import {
  booleanQuerySchema,
  dateQuerySchema,
  integerQueryRangeSchema,
} from "./request-schema-primitives";
import { createPaginatedSchema } from "./response-schema-primitives";

const examCalendarDateQuerySchema = dateQuerySchema()
  .transform((date) => parseRequiredDateInput(formatShanghaiDate(date)))
  .meta({
    override: {
      type: "string",
      description:
        "Inclusive Asia/Shanghai calendar date; accepts YYYY-MM-DD or ISO date/time.",
    },
  });

export const subscribedExamsQuerySchema = z
  .object({
    dateFrom: examCalendarDateQuerySchema.optional(),
    dateTo: examCalendarDateQuerySchema.optional(),
    includeDateUnknown: booleanQuerySchema.optional().default(true),
    semesterId: integerQueryRangeSchema({
      minimum: 1,
      message: "semesterId must be a positive integer",
    }).optional(),
    page: integerQueryRangeSchema({
      minimum: 1,
      maximum: 100000,
      message: "page must be between 1 and 100000",
    })
      .optional()
      .default(1),
    pageSize: integerQueryRangeSchema({
      minimum: 1,
      maximum: 100,
      message: "pageSize must be between 1 and 100",
    })
      .optional()
      .default(20),
    locale: z.enum(APP_LOCALES).optional(),
  })
  .refine(
    (input) =>
      !input.dateFrom || !input.dateTo || input.dateFrom <= input.dateTo,
    {
      message: "dateFrom must not be after dateTo",
      path: ["dateTo"],
    },
  );

export const subscribedExamsResponseSchema =
  createPaginatedSchema(subscribedExamSchema);

// Project the richer shared read model onto the existing public exam DTO.
export const subscribedExamDtoSchema = subscribedExamSchema.extend({
  section: subscribedExamSchema.shape.section
    .extend({
      course: subscribedExamSchema.shape.section.shape.course.strip(),
    })
    .strip(),
});
