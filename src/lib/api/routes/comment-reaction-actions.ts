import { createCommentReaction } from "@/features/comments/server/comment-mutations";
import { jsonResponse, notFound } from "@/lib/api/helpers";

export async function createCommentReactionAction(input: {
  commentId: string;
  type: string;
  userId: string;
}) {
  const result = await createCommentReaction(input);
  if (!result.ok) {
    return notFound();
  }

  return jsonResponse({ success: true });
}
