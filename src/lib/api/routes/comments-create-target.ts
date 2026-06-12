import { resolveCommentTarget } from "@/features/comments/server/comment-utils";
import { badRequest, notFound } from "@/lib/api/helpers";

export async function resolveCreateCommentTarget(input: {
  rawTargetId: unknown;
  sectionId?: Parameters<typeof resolveCommentTarget>[0]["sectionId"];
  targetType: Parameters<typeof resolveCommentTarget>[0]["targetType"];
  teacherId?: Parameters<typeof resolveCommentTarget>[0]["teacherId"];
}) {
  const target = await resolveCommentTarget({
    ...input,
    verifyExistence: true,
  });
  if (!target) {
    return { ok: false as const, response: badRequest("Invalid target") };
  }
  if (!target.verified) {
    return { ok: false as const, response: notFound("Target not found") };
  }
  return { ok: true as const, target };
}
