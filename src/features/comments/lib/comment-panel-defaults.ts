import type { ViewerContext } from "@/lib/auth/viewer-context";

export function createDefaultCommentViewer(): ViewerContext {
  return {
    userId: null,
    name: null,
    image: null,
    isAdmin: false,
    isAuthenticated: false,
    isSuspended: false,
    suspensionReason: null,
    suspensionExpiresAt: null,
  };
}

export function buildCommentVisibilityOptions(commentCopy: {
  visibilityPublic: string;
  visibilityLoggedIn: string;
}) {
  return [
    { value: "public", label: commentCopy.visibilityPublic },
    { value: "logged_in_only", label: commentCopy.visibilityLoggedIn },
  ];
}
