import { jsonResponse, notFound } from "@/lib/api/helpers";
import {
  cleanupDeletedUploadObject,
  writeUploadDeleteAuditLog,
} from "./upload-delete-cleanup";

export async function deleteUploadAction({
  id,
  request,
  userId,
}: {
  id: string;
  request: Request;
  userId: string;
}) {
  const { prisma } = await import("@/lib/db/prisma");
  const upload = await prisma.upload.findFirst({
    where: { id, userId },
    select: { id: true, key: true, size: true },
  });

  if (!upload) {
    return notFound();
  }

  await prisma.upload.delete({ where: { id: upload.id } });
  await cleanupDeletedUploadObject(upload);
  writeUploadDeleteAuditLog({ request, upload, userId });

  return jsonResponse({
    deletedId: upload.id,
    deletedSize: upload.size,
  });
}
