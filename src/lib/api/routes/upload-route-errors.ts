import { UploadError } from "@/features/uploads/lib/upload-quota";
import { badRequest, handleRouteError } from "@/lib/api/helpers";
import { deleteUploadObject } from "@/lib/api/routes/upload-session-actions";

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
