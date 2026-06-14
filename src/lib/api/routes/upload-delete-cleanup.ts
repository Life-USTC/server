import { handleRouteError } from "@/lib/api/helpers";
import {
  fireAuditLog,
  getAuditRequestMetadata,
} from "@/lib/audit/write-audit-log";
import { deleteStorageObject } from "@/lib/storage/r2-object";

export async function cleanupDeletedUploadObject(upload: { key: string }) {
  try {
    await deleteStorageObject(upload.key);
  } catch (storageError) {
    handleRouteError(
      "R2 object cleanup failed after upload deletion",
      storageError,
    );
  }
}

export function writeUploadDeleteAuditLog({
  request,
  upload,
  userId,
}: {
  request: Request;
  upload: { id: string; key: string; size: number };
  userId: string;
}) {
  fireAuditLog({
    action: "upload_delete",
    userId,
    targetId: upload.id,
    targetType: "upload",
    metadata: { key: upload.key, size: upload.size },
    ...getAuditRequestMetadata(request),
  });
}
