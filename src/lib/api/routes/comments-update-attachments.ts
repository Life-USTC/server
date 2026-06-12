export async function validateCommentAttachmentIds(
  prisma: {
    upload: {
      findMany: (input: {
        where: { id: { in: string[] }; userId: string };
        select: { id: true };
      }) => Promise<Array<{ id: string }>>;
    };
  },
  userId: string,
  attachmentIds: string[],
) {
  const uploads = await prisma.upload.findMany({
    where: {
      id: { in: attachmentIds },
      userId,
    },
    select: { id: true },
  });

  return uploads.length === attachmentIds.length;
}

export async function syncCommentAttachments(
  tx: {
    commentAttachment: {
      createMany: (input: {
        data: Array<{ commentId: string; uploadId: string }>;
        skipDuplicates: true;
      }) => Promise<unknown>;
      deleteMany: (input: {
        where: { commentId: string; uploadId?: { notIn: string[] } };
      }) => Promise<unknown>;
    };
  },
  commentId: string,
  attachmentIds: string[],
) {
  if (attachmentIds.length === 0) {
    await tx.commentAttachment.deleteMany({
      where: { commentId },
    });
    return;
  }

  await tx.commentAttachment.deleteMany({
    where: {
      commentId,
      uploadId: { notIn: attachmentIds },
    },
  });

  await tx.commentAttachment.createMany({
    data: attachmentIds.map((uploadId) => ({
      uploadId,
      commentId,
    })),
    skipDuplicates: true,
  });
}
