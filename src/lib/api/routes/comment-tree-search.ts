import type { CommentNode } from "@/features/comments/server/comment-serialization";

export function findComment(
  nodes: CommentNode[],
  id: string,
): CommentNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const nested = findComment(node.replies ?? [], id);
    if (nested) return nested;
  }
  return null;
}
