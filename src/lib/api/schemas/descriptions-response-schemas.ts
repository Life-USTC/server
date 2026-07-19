import * as z from "zod";
import { viewerContextSchema } from "./misc-response-schema-core";
import { dateTimeSchema } from "./response-schema-primitives";

const descriptionBaseSchema = z.object({
  id: z.string(),
  content: z.string(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
  lastEditedAt: dateTimeSchema.nullable(),
  lastEditedById: z.string().nullable(),
  sectionId: z.number().int().nullable(),
  courseId: z.number().int().nullable(),
  teacherId: z.number().int().nullable(),
  homeworkId: z.string().nullable(),
});

const descriptionEditBaseSchema = z.object({
  id: z.string(),
  descriptionId: z.string(),
  editorId: z.string().nullable(),
  previousContent: z.string().nullable(),
  nextContent: z.string(),
  createdAt: dateTimeSchema,
});

export const descriptionHistoryEntrySchema = descriptionEditBaseSchema
  .pick({
    id: true,
    createdAt: true,
    previousContent: true,
    nextContent: true,
  })
  .extend({
    editor: z
      .object({
        id: z.string(),
        name: z.string().nullable(),
        image: z.string().nullable(),
        username: z.string().nullable(),
      })
      .nullable(),
  });

export const descriptionDetailSchema = descriptionBaseSchema
  .pick({ id: true, content: true, updatedAt: true, lastEditedAt: true })
  .extend({
    id: z.string().nullable(),
    renderedHtml: z.string(),
    lastEditedBy: z
      .object({
        id: z.string(),
        name: z.string().nullable(),
        image: z.string().nullable(),
        username: z.string().nullable(),
      })
      .nullable(),
  });

export const descriptionsResponseSchema = z.object({
  description: descriptionDetailSchema,
  history: z.array(descriptionHistoryEntrySchema),
  viewer: viewerContextSchema,
});

export const descriptionUpsertResponseSchema = z.object({
  id: z.string(),
  updated: z.boolean(),
});
