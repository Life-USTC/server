import type {
  CommentStatus,
  CommentVisibility,
  Prisma,
} from "@/generated/prisma/client";

export type CommentVisibilityViewer = {
  isAdmin: boolean;
  isAuthenticated: boolean;
  userId: string | null;
};

export type CommentAuthenticationViewer = {
  isAuthenticated: boolean;
};

export type CommentVisibilitySubject = {
  status: CommentStatus | string;
  userId: string | null;
  visibility: CommentVisibility | string;
};

export function isSoftbannedCommentVisibleToViewer(
  status: CommentStatus | string,
  commentUserId: string | null,
  viewer: CommentVisibilityViewer,
) {
  if (status !== "softbanned") return true;
  return (
    viewer.isAdmin || (viewer.userId != null && commentUserId === viewer.userId)
  );
}

export function isLoggedInOnlyCommentVisibleToViewer(
  visibility: CommentVisibility | string,
  viewer: CommentAuthenticationViewer,
) {
  if (visibility !== "logged_in_only") return true;
  return viewer.isAuthenticated;
}

export function directlyVisibleCommentWhere(
  viewer: CommentVisibilityViewer,
): Prisma.CommentWhereInput {
  const visibleStatus: Prisma.CommentWhereInput = viewer.isAdmin
    ? { status: { in: ["active", "softbanned"] } }
    : viewer.userId
      ? {
          OR: [
            { status: "active" },
            { status: "softbanned", userId: viewer.userId },
          ],
        }
      : { status: "active" };

  return {
    AND: [
      visibleStatus,
      ...(viewer.isAuthenticated ? [] : [{ visibility: "public" as const }]),
    ],
  };
}

export function shouldHideCommentByVisibilityPolicy(
  comment: CommentVisibilitySubject,
  viewer: CommentVisibilityViewer,
  isAuthor: boolean,
) {
  if (comment.status === "softbanned" && !viewer.isAdmin && !isAuthor) {
    return true;
  }
  if (!isLoggedInOnlyCommentVisibleToViewer(comment.visibility, viewer)) {
    return true;
  }

  return false;
}

export function canViewerAccessCommentAttachment(
  comment: CommentVisibilitySubject,
  viewer: CommentVisibilityViewer,
) {
  if (!viewer.isAuthenticated) return false;
  if (comment.status === "deleted") return false;
  if (
    !isSoftbannedCommentVisibleToViewer(comment.status, comment.userId, viewer)
  ) {
    return false;
  }
  return (
    comment.visibility === "public" || comment.visibility === "logged_in_only"
  );
}
