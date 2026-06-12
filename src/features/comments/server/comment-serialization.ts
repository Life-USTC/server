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
import { buildVisibleCommentNode } from "./serialized-comment-node";

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
) {
  const childrenMap = buildCommentChildrenMap(rawComments);
  const nonDeletedIds = buildNonDeletedCommentIds(rawComments);
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
  }

  const roots: CommentNode[] = [];
  for (const node of visibleNodes.values()) {
    if (node.parentId && visibleNodes.has(node.parentId)) {
      visibleNodes.get(node.parentId)?.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  sortCommentReplies(roots);

  return { roots, hiddenCount };
}
