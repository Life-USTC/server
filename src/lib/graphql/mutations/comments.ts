import { deleteOwnCommentsBatch } from "@/features/comments/server/comment-batch-delete";
import {
  createComment,
  createCommentReaction,
  deleteCommentReaction,
  deleteOwnComment,
  updateOwnComment,
} from "@/features/comments/server/comment-mutations";
import type {
  CommentReactionType,
  CommentVisibility,
} from "@/generated/prisma/client";
import type { GraphqlContext } from "../context";
import { requireGraphqlId } from "../input-boundaries";
import { requireGraphqlMutation } from "../mutation-guard";
import {
  type commentTargetTypeResolver,
  normalizeCommentBody,
  normalizeIdList,
  rejectExplicitNullFields,
  requireMutationId,
} from "../mutation-input";
import {
  graphqlCommentAuditMetadata,
  handleCommentFailure,
  normalizeBatchIds,
} from "./shared";

type CommentTargetTypeInput =
  (typeof commentTargetTypeResolver)[keyof typeof commentTargetTypeResolver];

type CreateCommentInput = {
  attachmentIds?: string[] | null;
  body: string;
  courseJwId?: number | null;
  homeworkId?: string | null;
  isAnonymous?: boolean | null;
  parentId?: string | null;
  sectionId?: string | null;
  sectionJwId?: number | null;
  sectionTeacherId?: number | null;
  targetId?: string | null;
  targetType: CommentTargetTypeInput;
  teacherId?: string | null;
  visibility?: CommentVisibility | null;
};

type UpdateCommentInput = {
  attachmentIds?: string[] | null;
  body: string;
  isAnonymous?: boolean | null;
  visibility?: CommentVisibility | null;
};

export const commentMutationResolvers = {
  async commentCreate(
    _parent: unknown,
    args: { input: CreateCommentInput },
    context: GraphqlContext,
  ) {
    const principal = await requireGraphqlMutation(
      context,
      "community.comment",
    );
    const input = args.input;
    rejectExplicitNullFields(input, [
      "targetId",
      "sectionId",
      "sectionJwId",
      "courseJwId",
      "teacherId",
      "homeworkId",
      "sectionTeacherId",
      "visibility",
      "isAnonymous",
      "attachmentIds",
    ]);
    const result = await createComment({
      attachmentIds:
        normalizeIdList(input.attachmentIds, "attachmentIds") ?? undefined,
      auditMetadata: graphqlCommentAuditMetadata(context.request, principal),
      content: normalizeCommentBody(input.body),
      courseJwId:
        input.courseJwId == null
          ? undefined
          : requireGraphqlId(input.courseJwId, "courseJwId"),
      homeworkId:
        input.homeworkId == null
          ? undefined
          : requireMutationId(input.homeworkId, "homeworkId"),
      isAnonymous: input.isAnonymous === true,
      parentId:
        input.parentId == null
          ? input.parentId
          : requireMutationId(input.parentId, "parentId"),
      rawTargetId: input.targetId,
      sectionId: input.sectionId,
      sectionJwId:
        input.sectionJwId == null
          ? undefined
          : requireGraphqlId(input.sectionJwId, "sectionJwId"),
      sectionTeacherId:
        input.sectionTeacherId == null
          ? undefined
          : requireGraphqlId(input.sectionTeacherId, "sectionTeacherId"),
      targetType: input.targetType,
      teacherId: input.teacherId,
      userId: principal.userId,
      visibility: input.visibility ?? "public",
    });
    if (!result.ok) handleCommentFailure(result);
    return { id: result.comment.id };
  },
  async commentUpdate(
    _parent: unknown,
    args: { id: string; input: UpdateCommentInput },
    context: GraphqlContext,
  ) {
    const principal = await requireGraphqlMutation(
      context,
      "community.comment",
    );
    rejectExplicitNullFields(args.input, [
      "visibility",
      "isAnonymous",
      "attachmentIds",
    ]);
    const hasAttachmentUpdate = Object.hasOwn(args.input, "attachmentIds");
    const attachmentIds =
      normalizeIdList(args.input.attachmentIds, "attachmentIds") ?? [];
    const result = await updateOwnComment({
      attachmentIds,
      auditMetadata: graphqlCommentAuditMetadata(context.request, principal),
      body: normalizeCommentBody(args.input.body),
      hasAttachmentUpdate,
      id: requireMutationId(args.id, "id"),
      isAnonymous: args.input.isAnonymous ?? undefined,
      userId: principal.userId,
      visibility: args.input.visibility ?? undefined,
    });
    if (!result.ok) handleCommentFailure(result);
    return { id: result.comment.id };
  },
  async commentDelete(
    _parent: unknown,
    args: { id: string },
    context: GraphqlContext,
  ) {
    const principal = await requireGraphqlMutation(
      context,
      "community.comment",
    );
    const id = requireMutationId(args.id, "id");
    const result = await deleteOwnComment({
      auditMetadata: graphqlCommentAuditMetadata(context.request, principal),
      commentId: id,
      userId: principal.userId,
    });
    if (!result.ok) handleCommentFailure(result);
    return { id, success: true };
  },
  async commentsDelete(
    _parent: unknown,
    args: { ids: string[] },
    context: GraphqlContext,
  ) {
    const principal = await requireGraphqlMutation(
      context,
      "community.comment",
      {
        rateLimitTier: "batch",
      },
    );
    const ids = normalizeBatchIds(args.ids, "comment IDs", 50);
    return deleteOwnCommentsBatch({
      auditMetadata: graphqlCommentAuditMetadata(context.request, principal),
      ids,
      userId: principal.userId,
    });
  },
  async commentReactionAdd(
    _parent: unknown,
    args: { commentId: string; type: CommentReactionType },
    context: GraphqlContext,
  ) {
    const principal = await requireGraphqlMutation(
      context,
      "community.comment",
    );
    const commentId = requireMutationId(args.commentId, "commentId");
    const result = await createCommentReaction({
      auditMetadata: graphqlCommentAuditMetadata(context.request, principal),
      commentId,
      type: args.type,
      userId: principal.userId,
    });
    if (!result.ok) handleCommentFailure(result);
    return {
      commentId,
      type: args.type,
      active: true,
      changed: result.changed,
    };
  },
  async commentReactionRemove(
    _parent: unknown,
    args: { commentId: string; type: CommentReactionType },
    context: GraphqlContext,
  ) {
    const principal = await requireGraphqlMutation(
      context,
      "community.comment",
    );
    const commentId = requireMutationId(args.commentId, "commentId");
    const result = await deleteCommentReaction({
      auditMetadata: graphqlCommentAuditMetadata(context.request, principal),
      commentId,
      type: args.type,
      userId: principal.userId,
    });
    if (!result.ok) handleCommentFailure(result);
    return {
      commentId,
      type: args.type,
      active: false,
      changed: result.changed,
    };
  },
};
