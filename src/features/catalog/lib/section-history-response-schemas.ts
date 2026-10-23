import {
  createPaginatedSchema,
  dateTimeSchema,
} from "@/lib/api/schemas/response-schema-primitives";
import { sectionSummarySchema } from "./academic-section-list-response-schemas";

export const sectionHistoryEntrySchema = sectionSummarySchema.extend({
  retiredAt: dateTimeSchema.nullable(),
});

export const paginatedSectionHistoryResponseSchema = createPaginatedSchema(
  sectionHistoryEntrySchema,
);
