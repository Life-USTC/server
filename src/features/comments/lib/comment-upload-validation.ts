import type { CommentUploadSummary } from "./comment-upload-types";

export function validateCommentUploadFile({
  file,
  formatSize,
  summary,
  uploadCopy,
}: {
  file: File;
  formatSize: (value: number | undefined) => string;
  summary: CommentUploadSummary;
  uploadCopy: {
    toastFileTooLargeDescription: string;
    toastQuotaExceededDescription: string;
  };
}) {
  if (file.size > summary.maxFileSizeBytes) {
    throw new Error(
      uploadCopy.toastFileTooLargeDescription.replace(
        "{size}",
        formatSize(summary.maxFileSizeBytes),
      ),
    );
  }
  if (summary.usedBytes + file.size > summary.quotaBytes) {
    throw new Error(uploadCopy.toastQuotaExceededDescription);
  }
}
