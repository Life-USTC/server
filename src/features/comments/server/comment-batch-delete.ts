import { deleteOwnComment } from "./comment-mutations";

type CommentBatchDeleteAuditMetadata = {
  ipAddress?: string;
  source?: string;
  userAgent?: string;
};

type CommentBatchDeleteErrorCode = "forbidden" | "locked" | "not_found";

function commentBatchDeleteErrorMessage(
  code: CommentBatchDeleteErrorCode,
): string {
  switch (code) {
    case "not_found":
      return "Comment not found";
    case "locked":
      return "Comment locked";
    default:
      return "Forbidden";
  }
}

export async function deleteOwnCommentsBatch(input: {
  auditMetadata?: CommentBatchDeleteAuditMetadata;
  ids: readonly string[];
  userId: string;
}) {
  const results = await Promise.all(
    input.ids.map(async (id) => {
      const result = await deleteOwnComment({
        auditMetadata: input.auditMetadata,
        commentId: id,
        userId: input.userId,
      });
      if (!result.ok) {
        const code: CommentBatchDeleteErrorCode =
          result.error === "suspended" ? "forbidden" : result.error;
        return {
          success: false as const,
          id,
          error: { code, message: commentBatchDeleteErrorMessage(code) },
        };
      }
      return { success: true as const, id };
    }),
  );

  return { results };
}
