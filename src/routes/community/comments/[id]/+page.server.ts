import { error, redirect } from "@sveltejs/kit";
import { getCommentsCopy } from "@/features/comments/lib/comments-copy";
import { resolveCommentCanonicalUrl } from "@/features/comments/server/comment-canonical-url";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
  const copy = getCommentsCopy(locals.locale);
  const result = await resolveCommentCanonicalUrl(params.id, locals.locale);
  if (result.ok) redirect(303, result.url);
  if (result.reason === "not_found") error(404, copy.comments.commentNotFound);
  error(404, copy.comments.commentTargetNotFound);
};
