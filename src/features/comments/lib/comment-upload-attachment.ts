import {
  uploadCompleteResponseSchema,
  uploadCreateResponseSchema,
} from "@/lib/api/schemas/uploads-response-schemas";
import {
  commentUploadContentType,
  uploadSummaryFromResponse,
} from "./comment-upload-request";
import type { CommentUploadSummary } from "./comment-upload-types";
import { validateCommentUploadFile } from "./comment-upload-validation";

export async function uploadCommentAttachment({
  file,
  formatSize,
  loadSummary,
  setSummary,
  uploadCopy,
}: {
  file: File;
  formatSize: (value: number | undefined) => string;
  loadSummary: () => Promise<CommentUploadSummary>;
  setSummary: (summary: CommentUploadSummary) => void;
  uploadCopy: {
    toastFileTooLargeDescription: string;
    toastQuotaExceededDescription: string;
    toastUploadErrorDescription: string;
  };
}) {
  const summary = await loadSummary();
  validateCommentUploadFile({ file, formatSize, summary, uploadCopy });
  const contentType = commentUploadContentType(file);

  const createResponse = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType,
      size: file.size,
    }),
  });
  if (!createResponse.ok)
    throw new Error(uploadCopy.toastUploadErrorDescription);
  const uploadStart = uploadCreateResponseSchema.safeParse(
    await createResponse.json(),
  );
  if (!uploadStart.success)
    throw new Error(uploadCopy.toastUploadErrorDescription);

  setSummary(uploadSummaryFromResponse(uploadStart.data));

  const putResponse = await fetch(uploadStart.data.url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!putResponse.ok) throw new Error(uploadCopy.toastUploadErrorDescription);

  const completeResponse = await fetch("/api/uploads/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: uploadStart.data.key,
      filename: file.name,
      contentType,
    }),
  });
  if (!completeResponse.ok)
    throw new Error(uploadCopy.toastUploadErrorDescription);
  const completed = uploadCompleteResponseSchema.safeParse(
    await completeResponse.json(),
  );
  if (!completed.success)
    throw new Error(uploadCopy.toastUploadErrorDescription);

  setSummary(
    uploadSummaryFromResponse({
      maxFileSizeBytes: uploadStart.data.maxFileSizeBytes,
      quotaBytes: completed.data.quotaBytes,
      usedBytes: completed.data.usedBytes,
    }),
  );
  return completed.data.upload;
}
