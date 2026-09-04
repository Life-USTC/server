/** Rename, delete, and downloadable upload lookups. */
import { Prisma } from "@/generated/prisma/client";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { withUserDbContext } from "@/lib/db/prisma";
import {
  type DownloadableUpload,
  deleteUploadStorageObject,
  managedUploadSelect,
  publicUploadPayload,
  requireActiveUploadWriter,
  type UploadAuditContext,
  writeUploadDeleteAuditLog,
} from "./upload-service-shared";

export async function renameUpload(input: {
  filename: string;
  id: string;
  userId: string;
}) {
  return withUserDbContext(input.userId, async (tx) => {
    const upload = await tx.upload.findFirst({
      where: { id: input.id, userId: input.userId },
      select: { id: true },
    });

    if (!upload) return null;

    const updated = await tx.upload.update({
      where: { id: upload.id },
      data: { filename: input.filename },
      select: managedUploadSelect,
    });

    return publicUploadPayload(updated);
  });
}

export async function renameOwnedUpload(input: {
  filename: string;
  id: string;
  userId: string;
}) {
  const writer = await requireActiveUploadWriter(input.userId);
  if (!writer.ok) return writer;

  const upload = await renameUpload(input);
  if (!upload) return { ok: false as const, error: "not_found" as const };
  return { ok: true as const, upload };
}

async function findUploadRecordForDeletion(input: {
  id: string;
  userId: string;
}) {
  return withUserDbContext(input.userId, async (tx) => {
    const upload = await tx.upload.findFirst({
      where: { id: input.id, userId: input.userId },
      select: { id: true, key: true, size: true },
    });

    if (!upload) return null;
    return upload;
  });
}

export async function deleteOwnedUpload(input: {
  audit?: UploadAuditContext;
  id: string;
  userId: string;
}) {
  const writer = await requireActiveUploadWriter(input.userId);
  if (!writer.ok) return writer;

  const upload = await findUploadRecordForDeletion({
    id: input.id,
    userId: input.userId,
  });
  if (!upload) return { ok: false as const, error: "not_found" as const };

  const storageDeleted = await deleteUploadStorageObject(upload);
  if (!storageDeleted) {
    return {
      ok: false as const,
      error: "storage_delete_failed" as const,
    };
  }

  const metadataDeleted = await withUserDbContext(input.userId, async (tx) => {
    const deleted = await tx.upload.deleteMany({
      where: { id: upload.id, userId: input.userId },
    });
    if (deleted.count === 0) return false;

    await writeUploadDeleteAuditLog({
      audit: input.audit,
      client: tx,
      upload,
      userId: input.userId,
    });
    return true;
  });
  if (!metadataDeleted)
    return { ok: false as const, error: "not_found" as const };

  return {
    ok: true as const,
    deletedId: upload.id,
    deletedSize: upload.size,
  };
}

export async function findDownloadableUpload(id: string, userId: string) {
  const viewer = await getViewerContext({ includeAdmin: true, userId });
  if (!viewer.isAuthenticated) return null;

  const [upload] = await withUserDbContext(userId, (tx) =>
    tx.$queryRaw<DownloadableUpload[]>(Prisma.sql`
      SELECT *
      FROM public.find_downloadable_upload(${id})
    `),
  );
  return upload ?? null;
}
