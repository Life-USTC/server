import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { handleRouteError } from "@/lib/api/helpers";
import {
  fireAuditLog,
  getAuditRequestMetadata,
} from "@/lib/audit/write-audit-log";
import { getS3Bucket, sendS3 } from "@/lib/storage/s3";

export async function cleanupDeletedUploadObject(upload: { key: string }) {
  try {
    await sendS3(
      new DeleteObjectCommand({ Bucket: getS3Bucket(), Key: upload.key }),
    );
  } catch (s3Error) {
    handleRouteError("S3 object cleanup failed after upload deletion", s3Error);
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
