import { extractApiErrorMessage } from "@/lib/api/client";

export type UploadErrorCode =
  | "Quota exceeded"
  | "File too large"
  | "Presign failed"
  | "Upload failed"
  | "Finalize failed";

export class UploadFlowError extends Error {
  code: UploadErrorCode;

  constructor(code: UploadErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

export function extractUploadErrorCode(
  errorBody: unknown,
): UploadErrorCode | null {
  const error = extractApiErrorMessage(errorBody);
  if (error === "Quota exceeded" || error === "File too large") {
    return error;
  }

  return null;
}
