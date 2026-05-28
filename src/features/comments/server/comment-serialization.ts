import type {
  CommentReactionType,
  CommentStatus,
  CommentVisibility,
} from "@/generated/prisma/client";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";

export type CommentAuthorSummary = {
  id?: string;
  name: string | null;
  image?: string | null;
  isUstcVerified: boolean;
  isAdmin: boolean;
  isGuest: boolean;
};

export type CommentAttachmentSummary = {
  id: string;
  uploadId: string;
  filename: string;
  url: string;
  contentType: string | null;
  size: number;
};

export type CommentReactionSummary = {
  type: string;
  count: number;
  viewerHasReacted: boolean;
};

export type CommentNode = {
  id: string;
  body: string;
  visibility: CommentVisibility;
  status: CommentStatus;
  author: CommentAuthorSummary | null;
  authorHidden: boolean;
  isAnonymous: boolean;
  isAuthor: boolean;
  createdAt: string;
  updatedAt: string;
  parentId: string | null;
  rootId: string | null;
  replies: CommentNode[];
  attachments: CommentAttachmentSummary[];
  reactions: CommentReactionSummary[];
  canReply: boolean;
  canEdit: boolean;
  canModerate: boolean;
};

export type ViewerInfo = {
  userId: string | null;
  name: string | null;
  image: string | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
};

const MAX_SORT_DEPTH = 20;

type RawAccount = {
  provider: string;
};

type RawUser = {
  id: string;
  name: string | null;
  image: string | null;
  isAdmin?: boolean;
  accounts?: RawAccount[] | null;
};

type RawUpload = {
  filename?: string | null;
  contentType?: string | null;
  size?: number | null;
};

type RawAttachment = {
  id: string;
  uploadId: string;
  upload?: RawUpload | null;
};

type RawReaction = {
  type: CommentReactionType;
  userId: string | null;
};

export type RawComment = {
  id: string;
  body: string;
  visibility: CommentVisibility;
  status: CommentStatus;
  authorName?: string | null;
  isAnonymous?: boolean | null;
  userId?: string | null;
  user?: RawUser | null;
  createdAt: Date;
  updatedAt: Date;
  parentId?: string | null;
  rootId?: string | null;
  attachments?: RawAttachment[] | null;
  reactions?: RawReaction[] | null;
};

function buildAuthorSummary(comment: RawComment, _viewer: ViewerInfo) {
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

function buildReactionSummary(comment: RawComment, viewer: ViewerInfo) {
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

function buildAttachments(comment: RawComment) {
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

function shouldHideComment(
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

export function buildCommentNodes(
  rawComments: RawComment[],
  viewer: ViewerInfo,
) {
  const childrenMap = new Map<string, string[]>();
  for (const comment of rawComments) {
    if (comment.parentId) {
      const existing = childrenMap.get(comment.parentId) ?? [];
      existing.push(comment.id);
      childrenMap.set(comment.parentId, existing);
    }
  }

  const nonDeletedIds = new Set(
    rawComments
      .filter((comment) => comment.status !== "deleted")
      .map((comment) => comment.id),
  );

  const hasVisibleDescendant = new Map<string, boolean>();
  const computeHasVisibleDescendant = (id: string): boolean => {
    if (hasVisibleDescendant.has(id)) {
      return hasVisibleDescendant.get(id) ?? false;
    }
    const childIds = childrenMap.get(id) ?? [];
    const value = childIds.some(
      (childId) =>
        nonDeletedIds.has(childId) || computeHasVisibleDescendant(childId),
    );
    hasVisibleDescendant.set(id, value);
    return value;
  };

  const visibleNodes = new Map<string, CommentNode>();
  let hiddenCount = 0;

  for (const comment of rawComments) {
    const isAuthor = Boolean(viewer.userId && comment.userId === viewer.userId);
    const rawStatus = comment.status;
    const hasDescendant = computeHasVisibleDescendant(comment.id);
    if (shouldHideComment(comment, viewer, isAuthor, hasDescendant)) {
      if (
        comment.visibility === "logged_in_only" &&
        !viewer.isAuthenticated &&
        comment.status !== "deleted"
      ) {
        hiddenCount += 1;
      }
      continue;
    }

    const authorHidden =
      (comment.visibility === "anonymous" || Boolean(comment.isAnonymous)) &&
      !viewer.isAdmin &&
      !isAuthor;
    const author = authorHidden ? null : buildAuthorSummary(comment, viewer);
    const status =
      rawStatus === "softbanned" && !viewer.isAdmin ? "active" : rawStatus;

    visibleNodes.set(comment.id, {
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
    });
  }

  const roots: CommentNode[] = [];
  for (const node of visibleNodes.values()) {
    if (node.parentId && visibleNodes.has(node.parentId)) {
      visibleNodes.get(node.parentId)?.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortReplies = (nodes: CommentNode[], depth = 0) => {
    const maxDepth = depth >= MAX_SORT_DEPTH;
    nodes.sort((a, b) => {
      const aVerified = a.author?.isUstcVerified ? 1 : 0;
      const bVerified = b.author?.isUstcVerified ? 1 : 0;
      if (aVerified !== bVerified) return bVerified - aVerified;
      return a.createdAt.localeCompare(b.createdAt);
    });

    if (maxDepth) return;
    for (const node of nodes) {
      if (node.replies.length > 0) {
        sortReplies(node.replies, depth + 1);
      }
    }
  };

  sortReplies(roots);

  return { roots, hiddenCount };
}
