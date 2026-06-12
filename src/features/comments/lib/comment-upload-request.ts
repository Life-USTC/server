import type { CommentUploadSummary } from "./comment-upload-client";

export function commentUploadContentType(file: File) {
  return file.type || "application/octet-stream";
}

export function uploadSummaryFromResponse(input: {
  maxFileSizeBytes: number;
  quotaBytes: number;
  usedBytes: number;
}): CommentUploadSummary {
  return {
    maxFileSizeBytes: input.maxFileSizeBytes,
    quotaBytes: input.quotaBytes,
    usedBytes: input.usedBytes,
  };
}
