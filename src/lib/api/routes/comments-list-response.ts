import type {
  CommentTargetType,
  ResolvedCommentTarget,
} from "@/features/comments/server/comment-utils";

export function commentListTargetPayload(
  targetType: CommentTargetType,
  target: ResolvedCommentTarget,
) {
  return {
    type: targetType,
    targetId: target.targetId,
    sectionId: target.sectionId,
    teacherId: target.teacherId,
    sectionTeacherId: target.sectionTeacherId,
    homeworkId: target.homeworkId,
  };
}

export async function loadCommentThread(input: {
  request: Request;
  target: ResolvedCommentTarget;
}) {
  const [{ getViewerContext }, { prisma }, { buildCommentNodes }] =
    await Promise.all([
      import("@/lib/auth/viewer-context"),
      import("@/lib/db/prisma"),
      import("@/features/comments/server/comment-serialization"),
    ]);
  const { resolveApiUserId } = await import("@/lib/auth/api-auth");
  const { commentThreadInclude } = await import("./comments-read-helpers");

  const viewerUserId = await resolveApiUserId(input.request);
  const [viewer, comments] = await Promise.all([
    getViewerContext({ includeAdmin: false, userId: viewerUserId }),
    prisma.comment.findMany({
      where: input.target.whereTarget,
      include: commentThreadInclude,
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const { roots, hiddenCount } = buildCommentNodes(comments, viewer);
  return { comments: roots, hiddenCount, viewer };
}
