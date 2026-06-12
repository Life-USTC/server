import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import {
  buildAttachments,
  buildAuthorSummary,
  buildReactionSummary,
  shouldHideAuthor,
  shouldHideComment,
} from "./comment-serialization-helpers";
import type {
  CommentNode,
  RawComment,
  ViewerInfo,
} from "./comment-serialization-types";

type BuildVisibleCommentNodeOptions = {
  comment: RawComment;
  hasDescendant: boolean;
  viewer: ViewerInfo;
};

export function buildVisibleCommentNode({
  comment,
  hasDescendant,
  viewer,
}: BuildVisibleCommentNodeOptions): CommentNode | null {
  const isAuthor = Boolean(viewer.userId && comment.userId === viewer.userId);
  const rawStatus = comment.status;
  if (shouldHideComment(comment, viewer, isAuthor, hasDescendant)) {
    return null;
  }

  const authorHidden = shouldHideAuthor(comment, viewer, isAuthor);
  const author = authorHidden ? null : buildAuthorSummary(comment);
  const status =
    rawStatus === "softbanned" && !viewer.isAdmin ? "active" : rawStatus;

  return {
    id: comment.id,
    body: comment.body,
    visibility: comment.visibility,
    status,
    author,
    authorHidden,
    isAnonymous: Boolean(comment.isAnonymous),
    isAuthor,
    createdAt: toShanghaiIsoString(comment.createdAt),
    updatedAt: toShanghaiIsoString(comment.updatedAt),
    parentId: comment.parentId ?? null,
    rootId: comment.rootId ?? null,
    replies: [],
    attachments: buildAttachments(comment),
    reactions: buildReactionSummary(comment, viewer),
    canReply: viewer.isAuthenticated,
    canEdit: isAuthor && rawStatus !== "deleted",
    canModerate: viewer.isAdmin,
  };
}
