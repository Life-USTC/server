import { z } from "zod";
import {
  commentAttachmentSummarySchema,
  commentAuthorSummarySchema,
  commentReactionSummarySchema,
} from "@/lib/api/schemas/comment-node-response-schema";
import { commentsListResponseSchema } from "@/lib/api/schemas/comments-response-schemas";
import {
  descriptionDetailSchema,
  descriptionHistoryEntrySchema,
} from "@/lib/api/schemas/descriptions-response-schemas";
import { successResponseSchema } from "@/lib/api/schemas/misc-response-schema-core";
import {
  collectionOutputSchema,
  compactHomeworkSchema,
  compactSectionHomeworkItemSchema,
  compactUserSchema,
  contributionWeeksSchema,
  dateTimeSchema,
  homeworkCreateDefaultSchema,
  homeworkCreateFullSchema,
  homeworkItemFullMcpSchema,
  homeworkUpdateDefaultSchema,
  homeworkUpdateFullSchema,
  type McpToolOutputSchema,
  objectOutputSchema,
  objectOutputSchemaFromApi,
  publicProfileFullUserSchema,
  publicProfileOutputSchema,
  sectionHomeworkListDefaultSchema,
  sectionHomeworkListFullSchema,
  sectionPublicContextSchema,
  topLevelOutputSchema,
  viewerContextSchema,
} from "./shared";

export function createMcpCommentNodeSchema(
  includeRenderedBody: boolean,
): z.ZodType {
  let schema: z.ZodType;
  schema = z.lazy(() =>
    z
      .object({
        id: z.string(),
        body: z.string(),
        ...(includeRenderedBody ? { renderedBody: z.string() } : {}),
        visibility: z.string(),
        status: z.string(),
        author: commentAuthorSummarySchema.nullable(),
        authorHidden: z.boolean(),
        isAnonymous: z.boolean(),
        isAuthor: z.boolean(),
        createdAt: dateTimeSchema,
        updatedAt: dateTimeSchema,
        parentId: z.string().nullable(),
        rootId: z.string().nullable(),
        replies: z.array(schema),
        repliesNextCursor: z.string().nullable(),
        isAncestryPlaceholder: z.boolean().optional(),
        attachments: z.array(commentAttachmentSummarySchema),
        reactions: z.array(commentReactionSummarySchema),
        canReact: z.boolean(),
        canReply: z.boolean(),
        canEdit: z.boolean(),
        canDelete: z.boolean(),
        canModerate: z.boolean(),
      })
      .strict(),
  );
  return schema;
}

export const compactCommentNodeSchema = createMcpCommentNodeSchema(false);
export const fullCommentNodeSchema = createMcpCommentNodeSchema(true);
export const commentNodeMcpSchema = z.union([
  compactCommentNodeSchema,
  fullCommentNodeSchema,
]);

export const compactDescriptionDetailSchema = descriptionDetailSchema
  .omit({ renderedHtml: true })
  .strict();
export const descriptionDetailMcpSchema = z.union([
  compactDescriptionDetailSchema,
  descriptionDetailSchema.strict(),
]);

export function commentListOutputSchema(commentSchema: z.ZodType) {
  return objectOutputSchema({
    found: z.boolean(),
    data: collectionOutputSchema(commentSchema),
    pagination: commentsListResponseSchema.shape.pagination,
    meta: commentsListResponseSchema.shape.meta,
  });
}

export function commentThreadOutputSchema(commentSchema: z.ZodType) {
  return objectOutputSchema({
    thread: collectionOutputSchema(commentSchema),
    focusId: z.string(),
    hiddenCount: z.number().int().nonnegative(),
    viewer: z.unknown(),
    target: z.unknown(),
  });
}

export function commentRepliesOutputSchema(commentSchema: z.ZodType) {
  return objectOutputSchema({
    found: z.boolean(),
    rootId: z.string(),
    thread: collectionOutputSchema(commentSchema),
    nextCursor: z.string().nullable(),
    viewer: z.unknown(),
  });
}

export function descriptionOutputSchema(descriptionSchema: z.ZodType) {
  return objectOutputSchema({
    target: z.unknown(),
    description: descriptionSchema,
    history: collectionOutputSchema(descriptionHistoryEntrySchema),
    viewer: viewerContextSchema,
  });
}

export function descriptionUpsertOutputSchema(descriptionSchema: z.ZodType) {
  return objectOutputSchema({
    id: z.string(),
    updated: z.boolean(),
    target: z.unknown(),
    description: descriptionSchema,
    history: collectionOutputSchema(descriptionHistoryEntrySchema),
    viewer: viewerContextSchema,
  });
}

export const commentListMcpSchema =
  commentListOutputSchema(commentNodeMcpSchema);
export const commentThreadMcpSchema =
  commentThreadOutputSchema(commentNodeMcpSchema);
export const descriptionMcpSchema = descriptionOutputSchema(
  descriptionDetailMcpSchema,
);
export const descriptionUpsertMcpSchema = descriptionUpsertOutputSchema(
  descriptionDetailMcpSchema,
);

export const MARKDOWN_MODE_OUTPUT_SCHEMAS = {
  community_comment_list: {
    default: commentListOutputSchema(compactCommentNodeSchema),
    full: commentListOutputSchema(fullCommentNodeSchema),
  },
  community_comment_get: {
    default: commentThreadOutputSchema(compactCommentNodeSchema),
    full: commentThreadOutputSchema(fullCommentNodeSchema),
  },
  community_comment_replies: {
    default: commentRepliesOutputSchema(compactCommentNodeSchema),
    full: commentRepliesOutputSchema(fullCommentNodeSchema),
  },
  community_description_get: {
    default: descriptionOutputSchema(compactDescriptionDetailSchema),
    full: descriptionOutputSchema(descriptionDetailSchema.strict()),
  },
  community_description_set: {
    default: descriptionUpsertOutputSchema(compactDescriptionDetailSchema),
    full: descriptionUpsertOutputSchema(descriptionDetailSchema.strict()),
  },
} satisfies Record<string, Record<"default" | "full", McpToolOutputSchema>>;

export const communityModeOutputSchemas = {
  community_user_get: {
    default: publicProfileOutputSchema(compactUserSchema),
    full: publicProfileOutputSchema(publicProfileFullUserSchema),
  },
  community_section_homework_list: {
    default: sectionHomeworkListDefaultSchema,
    full: sectionHomeworkListFullSchema,
  },
  community_section_homework_create: {
    default: homeworkCreateDefaultSchema,
    full: homeworkCreateFullSchema,
  },
  community_section_homework_update: {
    default: homeworkUpdateDefaultSchema,
    full: homeworkUpdateFullSchema,
  },
} satisfies Record<string, Record<"default" | "full", McpToolOutputSchema>>;

export const communityToolOutputSchemas: Record<string, McpToolOutputSchema> = {
  community_user_get: objectOutputSchema({
    user: z.union([compactUserSchema, publicProfileFullUserSchema]),
    sectionCount: z.number().int().nonnegative(),
    weeks: contributionWeeksSchema,
    totalContributions: z.number().int().nonnegative(),
  }),
  community_section_homework_list: objectOutputSchema({
    section: sectionPublicContextSchema,
    homeworks: z.array(compactSectionHomeworkItemSchema),
  }),
  community_section_homework_create: objectOutputSchema({
    id: z.string(),
    homework: z.union([compactHomeworkSchema, homeworkItemFullMcpSchema]),
    reason: z.string().nullable(),
    hint: z.string(),
  }),
  community_section_homework_update: objectOutputSchema({
    homework: z.union([compactHomeworkSchema, homeworkItemFullMcpSchema]),
    reason: z.string().nullable(),
    hint: z.string(),
  }),
  community_section_homework_delete: topLevelOutputSchema([
    "deletedId",
    "alreadyDeleted",
    "reason",
  ]),
  community_comment_list: commentListMcpSchema,
  community_comment_get: commentThreadMcpSchema,
  community_comment_replies: commentRepliesOutputSchema(commentNodeMcpSchema),
  community_comment_create: objectOutputSchema({
    success: z.boolean(),
    id: z.string(),
  }),
  community_comment_update: topLevelOutputSchema(["comment"]),
  community_comment_delete: objectOutputSchemaFromApi(successResponseSchema),
  community_comment_reaction_add: objectOutputSchema({
    success: z.boolean(),
    changed: z.boolean(),
  }),
  community_comment_reaction_remove: objectOutputSchema({
    success: z.boolean(),
    changed: z.boolean(),
  }),
  community_description_get: descriptionMcpSchema,
  community_description_set: descriptionUpsertMcpSchema,
};
