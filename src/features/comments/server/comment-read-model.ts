import type { Prisma } from "@/generated/prisma/client";
import {
  getViewerContext,
  type ViewerContext,
} from "@/lib/auth/viewer-context";
import { prisma } from "@/lib/db/prisma";
import { buildCommentNodes, type CommentNode } from "./comment-serialization";
import type { ResolvedCommentTarget } from "./comment-utils";

export const commentThreadInclude = {
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
} as const;

export const commentTargetLookupSelect = {
  sectionId: true,
  courseId: true,
  teacherId: true,
  sectionTeacherId: true,
  rootId: true,
  id: true,
  homework: {
    select: {
      id: true,
      title: true,
      section: {
        select: { jwId: true, code: true },
      },
    },
  },
  sectionTeacher: {
    select: {
      sectionId: true,
      teacherId: true,
      section: {
        select: {
          jwId: true,
          code: true,
          course: {
            select: { jwId: true, nameCn: true },
          },
        },
      },
      teacher: {
        select: { nameCn: true },
      },
    },
  },
  section: {
    select: {
      jwId: true,
      code: true,
      course: {
        select: { jwId: true, nameCn: true },
      },
    },
  },
  course: {
    select: { jwId: true, nameCn: true },
  },
  teacher: {
    select: { nameCn: true },
  },
} as const;

export type CommentTargetLookupRecord = Prisma.CommentGetPayload<{
  select: typeof commentTargetLookupSelect;
}>;

function directlyVisibleCommentWhere(
  viewer: ViewerContext,
): Prisma.CommentWhereInput {
  const visibleStatus: Prisma.CommentWhereInput = viewer.isAdmin
    ? { status: { in: ["active", "softbanned"] } }
    : viewer.userId
      ? {
          OR: [
            { status: "active" },
            { status: "softbanned", userId: viewer.userId },
          ],
        }
      : { status: "active" };

  return {
    AND: [
      visibleStatus,
      ...(viewer.isAuthenticated ? [] : [{ visibility: "public" as const }]),
    ],
  };
}

export async function loadCommentThread(input: {
  pagination?: { pageSize: number; skip: number };
  target: ResolvedCommentTarget;
  viewer?: ViewerContext;
  viewerUserId: string | null;
}) {
  if (input.target.empty) {
    const viewer =
      input.viewer ??
      (await getViewerContext({
        includeAdmin: false,
        userId: input.viewerUserId,
      }));
    return { comments: [], hiddenCount: 0, total: 0, viewer };
  }

  if (input.pagination) {
    const viewer =
      input.viewer ??
      (await getViewerContext({
        includeAdmin: false,
        userId: input.viewerUserId,
      }));
    const directlyVisible = directlyVisibleCommentWhere(viewer);
    const rootWhere = {
      AND: [
        input.target.whereTarget,
        { parentId: null },
        {
          OR: [directlyVisible, { thread: { some: directlyVisible } }],
        },
      ],
    } satisfies Prisma.CommentWhereInput;
    const [total, rootComments, hiddenCount] = await Promise.all([
      prisma.comment.count({ where: rootWhere }),
      prisma.comment.findMany({
        where: rootWhere,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip: input.pagination.skip,
        take: input.pagination.pageSize,
        select: { id: true },
      }),
      viewer.isAuthenticated
        ? Promise.resolve(0)
        : prisma.comment.count({
            where: {
              AND: [
                input.target.whereTarget,
                { visibility: "logged_in_only" },
                { status: { not: "deleted" } },
              ],
            },
          }),
    ]);
    const rootIds = rootComments.map((comment) => comment.id);
    const comments =
      rootIds.length === 0
        ? []
        : await prisma.comment.findMany({
            where: {
              AND: [
                input.target.whereTarget,
                { OR: [{ id: { in: rootIds } }, { rootId: { in: rootIds } }] },
              ],
            },
            include: commentThreadInclude,
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          });

    const { roots } = buildCommentNodes(comments, viewer);
    return { comments: roots, hiddenCount, total, viewer };
  }

  const [viewer, comments] = await Promise.all([
    input.viewer
      ? Promise.resolve(input.viewer)
      : getViewerContext({ includeAdmin: false, userId: input.viewerUserId }),
    prisma.comment.findMany({
      where: input.target.whereTarget,
      include: commentThreadInclude,
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const { roots, hiddenCount } = buildCommentNodes(comments, viewer);
  return { comments: roots, hiddenCount, total: roots.length, viewer };
}

export async function loadFocusedCommentThread(input: {
  commentId: string;
  viewerUserId: string | null;
}) {
  const [comment, viewer] = await Promise.all([
    prisma.comment.findUnique({
      where: { id: input.commentId },
      select: commentTargetLookupSelect,
    }),
    getViewerContext({
      includeAdmin: false,
      userId: input.viewerUserId,
    }),
  ]);

  if (!comment) {
    return { ok: false as const, error: "not_found" as const };
  }

  const threadKey = comment.rootId ?? comment.id;
  const threadComments = await prisma.comment.findMany({
    where: {
      OR: [{ id: threadKey }, { rootId: threadKey }],
    },
    include: commentThreadInclude,
    orderBy: { createdAt: "asc" },
  });

  const { roots, hiddenCount } = buildCommentNodes(threadComments, viewer);
  const focus = findComment(roots, input.commentId);

  if (!focus) {
    return { ok: false as const, error: "forbidden" as const };
  }

  return {
    ok: true as const,
    focusId: input.commentId,
    hiddenCount,
    target: comment,
    thread: roots,
    viewer,
  };
}

function findComment(nodes: CommentNode[], id: string): CommentNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const nested = findComment(node.replies, id);
    if (nested) return nested;
  }
  return null;
}
