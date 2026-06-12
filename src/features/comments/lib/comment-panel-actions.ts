export async function submitCommentRequest(input: {
  attachmentIds: string[];
  body: string;
  isAnonymous: boolean;
  parentId?: string | null;
  submitFailed: string;
  targetPayload: Record<string, unknown>;
  visibility: string;
}) {
  const response = await fetch("/api/comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...input.targetPayload,
      body: input.body,
      visibility: input.visibility,
      isAnonymous: input.isAnonymous,
      parentId: input.parentId ?? null,
      attachmentIds: input.attachmentIds,
    }),
  });
  if (!response.ok) throw new Error(input.submitFailed);
}

export async function saveCommentEditRequest(input: {
  attachmentIds: string[];
  body: string;
  commentId: string;
  isAnonymous: boolean;
  submitFailed: string;
  visibility: string;
}) {
  const response = await fetch(`/api/comments/${input.commentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      body: input.body,
      visibility: input.visibility,
      isAnonymous: input.isAnonymous,
      attachmentIds: input.attachmentIds,
    }),
  });
  if (!response.ok) throw new Error(input.submitFailed);
}

export async function submitCommentReactionRequest(input: {
  commentId: string;
  reactionFailed: string;
  shouldRemove: boolean;
  type: string;
}) {
  const url = input.shouldRemove
    ? `/api/comments/${input.commentId}/reactions?type=${encodeURIComponent(input.type)}`
    : `/api/comments/${input.commentId}/reactions`;
  const response = await fetch(url, {
    method: input.shouldRemove ? "DELETE" : "POST",
    headers: input.shouldRemove
      ? undefined
      : { "Content-Type": "application/json" },
    body: input.shouldRemove ? undefined : JSON.stringify({ type: input.type }),
  });
  if (!response.ok) throw new Error(input.reactionFailed);
}

export async function deleteCommentRequest(input: {
  commentId: string;
  submitFailed: string;
}) {
  const response = await fetch(`/api/comments/${input.commentId}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error(input.submitFailed);
}
