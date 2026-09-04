import type { Prisma } from "@/generated/prisma/client";
import { withUserDbContext } from "@/lib/db/prisma";

export async function validateCommentAttachmentIds(
  userId: string,
  attachmentIds: string[],
  options: { commentId?: string } = {},
) {
  const uploads = await withUserDbContext(userId, (tx) =>
    tx.upload.findMany({
      where: {
        id: { in: attachmentIds },
        userId,
      },
      select: {
        id: true,
        commentAttachments: {
          select: { commentId: true },
        },
      },
    }),
  );

  return (
    uploads.length === attachmentIds.length &&
    uploads.every((upload) =>
      upload.commentAttachments.every(
        (attachment) => attachment.commentId === options.commentId,
      ),
    )
  );
}

export async function syncCommentAttachments(
  tx: Prisma.TransactionClient,
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

  const existingAttachments = await tx.commentAttachment.findMany({
    where: {
      commentId,
      uploadId: { in: attachmentIds },
    },
    select: { uploadId: true },
  });
  const existingUploadIds = new Set(
    existingAttachments.map((attachment) => attachment.uploadId),
  );
  const newAttachmentIds = attachmentIds.filter(
    (uploadId) => !existingUploadIds.has(uploadId),
  );

  if (newAttachmentIds.length === 0) return;

  await tx.commentAttachment.createMany({
    data: newAttachmentIds.map((uploadId) => ({
      uploadId,
      commentId,
    })),
  });
}
