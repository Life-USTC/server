import { campusReferenceMarkdownPlugins } from "@/features/markdown/lib/campus-reference-markdown";
import { renderMarkdown } from "@/lib/components/markdown-preview-renderer";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import { canViewerAccessCommentAttachment } from "./comment-attachment-access";
import { canViewerWriteCommentInteraction } from "./comment-interaction-policy";
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
  const canInteract = canViewerWriteCommentInteraction(
    {
      status: rawStatus,
      visibility: comment.visibility,
    },
    viewer,
  );

  return {
    id: comment.id,
    body: comment.body,
    renderedBody: renderMarkdown(comment.body, {
      remarkPlugins: campusReferenceMarkdownPlugins,
    }),
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
    attachments: canViewerAccessCommentAttachment(
      {
        status: rawStatus,
        userId: comment.userId ?? null,
        visibility: comment.visibility,
      },
      viewer,
    )
      ? buildAttachments(comment)
      : [],
    reactions: buildReactionSummary(comment, viewer),
    canReact: canInteract,
    canReply: canInteract,
    canEdit: canInteract && isAuthor,
    canDelete: canInteract && isAuthor,
    canModerate: viewer.isAdmin && !viewer.isSuspended,
  };
}
