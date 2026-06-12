import type {
  CommentAttachmentSummary,
  CommentAuthorSummary,
  CommentReactionSummary,
  RawComment,
  ViewerInfo,
} from "./comment-serialization-types";

export function buildAuthorSummary(comment: RawComment) {
  const user = comment.user;

  const isGuest = !user?.id;
  const isUstcVerified = Boolean(
    user?.accounts?.some((account) => account.provider === "oidc"),
  );

  return {
    id: user?.id,
    name: user?.name ?? comment.authorName ?? null,
    image: user?.image ?? null,
    isUstcVerified,
    isAdmin: Boolean(user?.isAdmin),
    isGuest,
  } satisfies CommentAuthorSummary;
}

export function buildReactionSummary(comment: RawComment, viewer: ViewerInfo) {
  const reactionMap = new Map<string, CommentReactionSummary>();
  const reactions = Array.isArray(comment.reactions) ? comment.reactions : [];

  for (const reaction of reactions) {
    const type = reaction.type;
    const entry = reactionMap.get(type) ?? {
      type,
      count: 0,
      viewerHasReacted: false,
    };
    entry.count += 1;
    if (viewer.userId && reaction.userId === viewer.userId) {
      entry.viewerHasReacted = true;
    }
    reactionMap.set(type, entry);
  }

  return Array.from(reactionMap.values());
}

export function buildAttachments(comment: RawComment) {
  const attachments = Array.isArray(comment.attachments)
    ? comment.attachments
    : [];
  return attachments.map((attachment) => {
    const upload = attachment.upload ?? {};
    return {
      id: attachment.id,
      uploadId: attachment.uploadId,
      filename: upload.filename ?? "",
      url: `/api/uploads/${attachment.uploadId}/download`,
      contentType: upload.contentType ?? null,
      size: upload.size ?? 0,
    } satisfies CommentAttachmentSummary;
  });
}

export function shouldHideComment(
  comment: RawComment,
  viewer: ViewerInfo,
  isAuthor: boolean,
  hasVisibleDescendant: boolean,
) {
  if (comment.status === "deleted" && !hasVisibleDescendant) return true;
  if (comment.status === "softbanned" && !viewer.isAdmin && !isAuthor)
    return true;
  if (comment.visibility === "logged_in_only" && !viewer.isAuthenticated)
    return true;

  return false;
}

export function shouldHideAuthor(
  comment: RawComment,
  viewer: ViewerInfo,
  isAuthor: boolean,
) {
  return (
    (comment.visibility === "anonymous" || Boolean(comment.isAnonymous)) &&
    !viewer.isAdmin &&
    !isAuthor
  );
}
