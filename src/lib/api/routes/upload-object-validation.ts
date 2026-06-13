import { uploadConfig } from "@/features/uploads/lib/upload-config";
import { UploadError } from "@/features/uploads/lib/upload-quota";
import { normalizeContentType } from "@/features/uploads/lib/upload-utils";
import {
  deleteStorageObject,
  headStorageObject,
} from "@/lib/storage/r2-object";

export async function validateUploadedObject(input: {
  contentType?: string | null;
  key: string;
}) {
  const head = await headStorageObject(input.key);

  const size = head.size;
  if (!size || size <= 0) {
    throw new UploadError("Uploaded object missing");
  }

  if (size > uploadConfig.maxFileSizeBytes) {
    await deleteStorageObject(input.key);
    throw new UploadError("File too large");
  }

  return {
    contentType: normalizeContentType(input.contentType) ?? head.contentType,
    size,
  };
}
