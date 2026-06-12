import type { CommentNode, RawComment } from "./comment-serialization-types";

const MAX_SORT_DEPTH = 20;

export function buildCommentChildrenMap(rawComments: RawComment[]) {
  const childrenMap = new Map<string, string[]>();
  for (const comment of rawComments) {
    if (!comment.parentId) continue;
    const existing = childrenMap.get(comment.parentId) ?? [];
    existing.push(comment.id);
    childrenMap.set(comment.parentId, existing);
  }
  return childrenMap;
}

export function buildNonDeletedCommentIds(rawComments: RawComment[]) {
  return new Set(
    rawComments
      .filter((comment) => comment.status !== "deleted")
      .map((comment) => comment.id),
  );
}

export function commentHasVisibleDescendant(
  id: string,
  childrenMap: Map<string, string[]>,
  nonDeletedIds: Set<string>,
  cache: Map<string, boolean>,
): boolean {
  if (cache.has(id)) {
    return cache.get(id) ?? false;
  }
  const childIds = childrenMap.get(id) ?? [];
  const value = childIds.some(
    (childId) =>
      nonDeletedIds.has(childId) ||
      commentHasVisibleDescendant(childId, childrenMap, nonDeletedIds, cache),
  );
  cache.set(id, value);
  return value;
}

export function sortCommentReplies(nodes: CommentNode[], depth = 0) {
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
      sortCommentReplies(node.replies, depth + 1);
    }
  }
}
