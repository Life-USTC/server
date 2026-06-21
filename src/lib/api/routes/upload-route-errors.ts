import { UploadError } from "@/features/uploads/server/upload-quota";
import { deleteUploadObject } from "@/features/uploads/server/upload-service";
import { badRequest, handleRouteError } from "@/lib/api/helpers";

export function uploadCreateErrorResponse(error: unknown) {
  if (error instanceof UploadError) {
    return badRequest(error.code);
  }
  return handleRouteError("Failed to create upload", error);
}

export async function uploadCompleteErrorResponse(error: unknown, key: string) {
  if (error instanceof UploadError) {
    if (
      error.code === "Quota exceeded" ||
      error.code === "Upload session expired"
    ) {
      await deleteUploadObject(key);
    }
    return badRequest(error.code);
  }
  return handleRouteError("Failed to finalize upload", error);
}
