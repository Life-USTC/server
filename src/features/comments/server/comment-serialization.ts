import type {
  CommentNode,
  RawComment,
  ViewerInfo,
} from "./comment-serialization-types";
import {
  buildCommentChildrenMap,
  buildNonDeletedCommentIds,
  commentHasVisibleDescendant,
  sortCommentReplies,
} from "./comment-tree";
import {
  buildAncestryPlaceholderNode,
  buildVisibleCommentNode,
} from "./serialized-comment-node";

export type {
  CommentAttachmentSummary,
  CommentAuthorSummary,
  CommentNode,
  CommentReactionSummary,
  RawComment,
  ViewerInfo,
} from "./comment-serialization-types";

export function buildCommentNodes(
  rawComments: RawComment[],
  viewer: ViewerInfo,
  options: {
    repliesNextCursorByRootId?: ReadonlyMap<string, string | null>;
  } = {},
) {
  const childrenMap = buildCommentChildrenMap(rawComments);
  const nonDeletedIds = buildNonDeletedCommentIds(rawComments);
  const rawById = new Map(rawComments.map((comment) => [comment.id, comment]));
  const descendantCache = new Map<string, boolean>();
  const visibleNodes = new Map<string, CommentNode>();
  let hiddenCount = 0;

  for (const comment of rawComments) {
    const node = buildVisibleCommentNode({
      comment,
      hasDescendant: commentHasVisibleDescendant(
        comment.id,
        childrenMap,
        nonDeletedIds,
        descendantCache,
      ),
      viewer,
    });
    if (!node) {
      if (
        comment.visibility === "logged_in_only" &&
        !viewer.isAuthenticated &&
        comment.status !== "deleted"
      ) {
        hiddenCount += 1;
      }
      continue;
    }

    visibleNodes.set(comment.id, node);
    const repliesNextCursor = options.repliesNextCursorByRootId?.get(
      comment.id,
    );
    if (repliesNextCursor !== undefined) {
      node.repliesNextCursor = repliesNextCursor;
    }
  }

  const placeholderSourceByRootId = new Map<string, CommentNode>();
  for (const node of visibleNodes.values()) {
    if (!node.rootId || node.id === node.rootId) continue;
    // Placeholder timestamps are derived only from visible descendants. Pick
    // the same earliest-descendant key used by root paging, independent of
    // the database hydration order.
    const previous = placeholderSourceByRootId.get(node.rootId);
    if (!previous || compareCommentOrder(node, previous) < 0) {
      placeholderSourceByRootId.set(node.rootId, node);
    }
  }

  for (const node of Array.from(visibleNodes.values())) {
    ensureAncestryPlaceholders(
      node,
      visibleNodes,
      rawById,
      placeholderSourceByRootId,
    );
  }

  const roots: CommentNode[] = [];
  for (const node of visibleNodes.values()) {
    if (node.parentId && visibleNodes.has(node.parentId)) {
      visibleNodes.get(node.parentId)?.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  for (const [rootId, cursor] of options.repliesNextCursorByRootId ?? []) {
    const root = visibleNodes.get(rootId);
    if (root) root.repliesNextCursor = cursor;
  }

  sortCommentReplies(roots);

  return { roots, hiddenCount };
}

function ensureAncestryPlaceholders(
  node: CommentNode,
  visibleNodes: Map<string, CommentNode>,
  rawById: Map<string, RawComment>,
  placeholderSourceByRootId: ReadonlyMap<string, CommentNode>,
) {
  const rootId = node.rootId;
  if (rootId && !visibleNodes.has(rootId)) {
    visibleNodes.set(
      rootId,
      buildAncestryPlaceholder({
        id: rootId,
        parentId: null,
        rawById,
        rootId,
        source: placeholderSourceByRootId.get(rootId) ?? node,
      }),
    );
  }

  const visited = new Set([node.id]);
  let parentId = node.parentId;
  while (parentId && !visibleNodes.has(parentId)) {
    if (visited.has(parentId)) break;
    visited.add(parentId);
    const parent = buildAncestryPlaceholder({
      id: parentId,
      parentId: null,
      rawById,
      rootId,
      source: node,
    });
    visibleNodes.set(parentId, parent);
    parentId = parent.parentId;
  }
}

function compareCommentOrder(a: CommentNode, b: CommentNode) {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

function buildAncestryPlaceholder(input: {
  id: string;
  parentId: string | null;
  rawById: Map<string, RawComment>;
  rootId: string | null;
  source: CommentNode;
}) {
  const raw = input.rawById.get(input.id);
  const rootId = raw?.rootId ?? input.rootId;
  const parentId = raw
    ? (raw.parentId ?? (input.id === rootId ? null : rootId))
    : (input.parentId ?? (input.id === rootId ? null : rootId));
  return buildAncestryPlaceholderNode({
    createdAt: new Date(input.source.createdAt),
    id: input.id,
    parentId: input.id === rootId ? null : parentId,
    rootId,
    updatedAt: new Date(input.source.updatedAt),
  });
}
