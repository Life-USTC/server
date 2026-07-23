import { apiClient } from "@/lib/api/client";

export async function submitCommentRequest(input: {
  attachmentIds: string[];
  body: string;
  isAnonymous: boolean;
  parentId?: string | null;
  submitFailed: string;
  targetPayload: Record<string, unknown>;
  visibility: string;
}) {
  const result = await apiClient.POST("/api/community/comments", {
    body: {
      ...input.targetPayload,
      body: input.body,
      visibility: input.visibility,
      isAnonymous: input.isAnonymous,
      parentId: input.parentId ?? null,
      attachmentIds: input.attachmentIds,
    },
  });
  if (!result.response.ok) throw new Error(input.submitFailed);
}

export async function saveCommentEditRequest(input: {
  attachmentIds: string[];
  body: string;
  commentId: string;
  isAnonymous: boolean;
  submitFailed: string;
  visibility: string;
}) {
  const result = await apiClient.PATCH(
    `/api/community/comments/${input.commentId}`,
    {
      body: {
        body: input.body,
        visibility: input.visibility,
        isAnonymous: input.isAnonymous,
        attachmentIds: input.attachmentIds,
      },
    },
  );
  if (!result.response.ok) throw new Error(input.submitFailed);
}

export async function submitCommentReactionRequest(input: {
  commentId: string;
  reactionFailed: string;
  shouldRemove: boolean;
  type: string;
}) {
  const path = `/api/community/comments/${input.commentId}/reactions`;
  const result = input.shouldRemove
    ? await apiClient.DELETE(path, { params: { query: { type: input.type } } })
    : await apiClient.POST(path, { body: { type: input.type } });
  if (!result.response.ok) throw new Error(input.reactionFailed);
}

export async function deleteCommentRequest(input: {
  commentId: string;
  submitFailed: string;
}) {
  const result = await apiClient.DELETE(
    `/api/community/comments/${input.commentId}`,
  );
  if (!result.response.ok) throw new Error(input.submitFailed);
}
