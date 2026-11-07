import { error, redirect } from "@sveltejs/kit";
import { getCommentsCopy } from "@/features/comments/lib/comments-copy";
import { resolveCommentCanonicalUrl } from "@/features/comments/server/comment-canonical-url";
import { getDemoCommunityPermalink } from "@/features/demo/server/demo-community";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
  const copy = getCommentsCopy(locals.locale);
  if (locals.demo) {
    const url = getDemoCommunityPermalink(params.id, locals.locale);
    if (url) redirect(303, url);
    error(404, copy.comments.commentNotFound);
  }
  const result = await resolveCommentCanonicalUrl(params.id, locals.locale);
  if (result.ok) redirect(303, result.url);
  if (result.reason === "not_found") error(404, copy.comments.commentNotFound);
  error(404, copy.comments.commentTargetNotFound);
};
