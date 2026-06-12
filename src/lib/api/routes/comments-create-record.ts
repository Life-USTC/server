import type { CommentVisibility } from "@/generated/prisma/client";

type CommentCreatePrisma = {
  comment: {
    create: (input: {
      data: {
        authorName: string | null;
        body: string;
        isAnonymous: boolean;
        parentId: string | null;
        rootId: string | null;
        status: "active";
        userId: string;
        visibility: CommentVisibility;
      } & Record<string, unknown>;
    }) => Promise<{ id: string }>;
    update: (input: {
      where: { id: string };
      data: { rootId: string };
    }) => Promise<unknown>;
  };
  commentAttachment: {
    createMany: (input: {
      data: Array<{ commentId: string; uploadId: string }>;
      skipDuplicates: true;
    }) => Promise<unknown>;
  };
};

type CreateCommentParent = {
  parentId: string | null;
  rootId: string | null;
};

type CreateCommentTarget = {
  target: {
    whereTarget: Record<string, unknown>;
  };
};

export async function createCommentRecord(
  prisma: CommentCreatePrisma,
  {
    attachmentIds,
    content,
    isAnonymous,
    parent,
    target,
    userId,
    visibility,
  }: {
    attachmentIds: string[];
    content: string;
    isAnonymous: boolean;
    parent: CreateCommentParent;
    target: CreateCommentTarget;
    userId: string;
    visibility: string;
  },
) {
  const comment = await prisma.comment.create({
    data: {
      body: content,
      visibility: visibility as CommentVisibility,
      status: "active",
      isAnonymous,
      authorName: null,
      userId,
      parentId: parent.parentId,
      rootId: parent.rootId,
      ...target.target.whereTarget,
    },
  });

  if (!parent.rootId) {
    await prisma.comment.update({
      where: { id: comment.id },
      data: { rootId: comment.id },
    });
  }

  if (attachmentIds.length > 0) {
    await prisma.commentAttachment.createMany({
      data: attachmentIds.map((uploadId) => ({
        uploadId,
        commentId: comment.id,
      })),
      skipDuplicates: true,
    });
  }

  return comment;
}
