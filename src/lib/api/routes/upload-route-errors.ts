import { UploadError } from "@/features/uploads/server/upload-quota";
import { badRequest, handleRouteError } from "@/lib/api/helpers";

export function uploadCreateErrorResponse(error: unknown) {
  if (error instanceof UploadError) {
    return badRequest(error.code);
  }
  return handleRouteError("Failed to create upload", error);
}

export function uploadCompleteErrorResponse(error: unknown) {
  if (error instanceof UploadError) {
    return badRequest(error.code);
  }
  return handleRouteError("Failed to finalize upload", error);
}
