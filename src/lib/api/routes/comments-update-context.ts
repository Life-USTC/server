import { forbidden, notFound } from "@/lib/api/helpers";

export async function loadEditableCommentContext({
  id,
  userId,
}: {
  id: string;
  userId: string;
}) {
  const [{ getViewerContext }, { prisma }] = await Promise.all([
    import("@/lib/auth/viewer-context"),
    import("@/lib/db/prisma"),
  ]);
  const viewer = await getViewerContext({ userId });
  const comment = await prisma.comment.findUnique({
    where: { id },
    select: { id: true, status: true, userId: true },
  });

  if (!comment) {
    return { error: notFound() };
  }

  if (String(comment.status) === "deleted") {
    return { error: forbidden("Comment locked") };
  }

  if (!viewer.isAdmin && comment.userId !== viewer.userId) {
    return { error: forbidden() };
  }

  return { prisma, viewer };
}
