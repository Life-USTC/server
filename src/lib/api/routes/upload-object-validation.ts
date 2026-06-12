import { DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { uploadConfig } from "@/features/uploads/lib/upload-config";
import { UploadError } from "@/features/uploads/lib/upload-quota";
import { normalizeContentType } from "@/features/uploads/lib/upload-utils";
import { getS3Bucket, sendS3 } from "@/lib/storage/s3";

export async function validateUploadedObject(input: {
  contentType?: string | null;
  key: string;
}) {
  const bucket = getS3Bucket();
  const head = await sendS3(
    new HeadObjectCommand({ Bucket: bucket, Key: input.key }),
  );

  const size = head.ContentLength ?? 0;
  if (!size || size <= 0) {
    throw new UploadError("Uploaded object missing");
  }

  if (size > uploadConfig.maxFileSizeBytes) {
    await sendS3(new DeleteObjectCommand({ Bucket: bucket, Key: input.key }));
    throw new UploadError("File too large");
  }

  return {
    contentType: normalizeContentType(input.contentType) ?? head.ContentType,
    size,
  };
}
