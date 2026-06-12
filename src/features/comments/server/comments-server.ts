import { getViewerContext } from "@/lib/auth/viewer-context";
import { prisma } from "@/lib/db/prisma";
import { buildCommentNodes } from "./comment-serialization";
import type {
  CommentNode,
  CommentTarget,
  CommentViewer,
} from "./comment-types";
import { resolveSectionTeacherId } from "./comment-utils";

type CommentsPayload = {
  comments: CommentNode[];
  hiddenCount: number;
  viewer: CommentViewer;
};

export async function getCommentsPayload(
  target: CommentTarget,
  viewerOverride?: CommentViewer,
): Promise<CommentsPayload> {
  const viewer =
    viewerOverride ?? (await getViewerContext({ includeAdmin: false }));
  const viewerInfo = {
    userId: viewer.userId,
    name: viewer.name,
    image: viewer.image,
    isAdmin: viewer.isAdmin,
    isAuthenticated: viewer.isAuthenticated,
  };

  let whereTarget: Record<string, number | string> | null = null;
  let resolvedSectionTeacherId: number | null = null;

  if (target.type === "section" && target.targetId) {
    whereTarget = { sectionId: target.targetId };
  } else if (target.type === "course" && target.targetId) {
    whereTarget = { courseId: target.targetId };
  } else if (target.type === "teacher" && target.targetId) {
    whereTarget = { teacherId: target.targetId };
  } else if (target.type === "homework") {
    const homeworkId =
      target.homeworkId ?? (target.targetId as string | undefined);
    if (homeworkId) {
      whereTarget = { homeworkId };
    }
  } else if (target.type === "section-teacher") {
    const sectionTeacherId = target.sectionTeacherId ?? target.targetId ?? null;
    if (sectionTeacherId) {
      resolvedSectionTeacherId = sectionTeacherId;
    } else if (target.sectionId && target.teacherId) {
      resolvedSectionTeacherId = await resolveSectionTeacherId(
        target.sectionId,
        target.teacherId,
      );
    }

    if (resolvedSectionTeacherId) {
      whereTarget = { sectionTeacherId: resolvedSectionTeacherId };
    }
  }

  if (!whereTarget) {
    return { comments: [], hiddenCount: 0, viewer };
  }

  const comments = await prisma.comment.findMany({
    where: whereTarget,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          image: true,
          isAdmin: true,
          accounts: {
            select: {
              provider: true,
            },
          },
        },
      },
      attachments: {
        include: {
          upload: {
            select: {
              filename: true,
              contentType: true,
              size: true,
            },
          },
        },
      },
      reactions: {
        select: {
          type: true,
          userId: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const { roots, hiddenCount } = buildCommentNodes(comments, viewerInfo);

  return { comments: roots, hiddenCount, viewer };
}
