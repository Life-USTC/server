import * as z from "zod";
import { dateTimeSchema } from "./response-schema-primitives";

export const commentAuthorSummarySchema = z.object({
  id: z.string().optional(),
  name: z.string().nullable(),
  image: z.string().nullable().optional(),
  isUstcVerified: z.boolean(),
  isAdmin: z.boolean(),
  isGuest: z.boolean(),
});

export const commentAttachmentSummarySchema = z.object({
  id: z.string(),
  uploadId: z.string(),
  filename: z.string(),
  url: z.string(),
  contentType: z.string().nullable(),
  size: z.number().int(),
});

export const commentReactionSummarySchema = z.object({
  type: z.string(),
  count: z.number().int().nonnegative(),
  viewerHasReacted: z.boolean(),
});

export type CommentNode = {
  id: string;
  body: string;
  visibility: string;
  status: string;
  author: z.infer<typeof commentAuthorSummarySchema> | null;
  authorHidden: boolean;
  isAnonymous: boolean;
  isAuthor: boolean;
  createdAt: string;
  updatedAt: string;
  parentId: string | null;
  rootId: string | null;
  replies: CommentNode[];
  attachments: z.infer<typeof commentAttachmentSummarySchema>[];
  reactions: z.infer<typeof commentReactionSummarySchema>[];
  canReply: boolean;
  canEdit: boolean;
  canModerate: boolean;
};

export const commentNodeSchema: z.ZodType<CommentNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    body: z.string(),
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
    replies: z.array(commentNodeSchema),
    attachments: z.array(commentAttachmentSummarySchema),
    reactions: z.array(commentReactionSummarySchema),
    canReply: z.boolean(),
    canEdit: z.boolean(),
    canModerate: z.boolean(),
  }),
);
