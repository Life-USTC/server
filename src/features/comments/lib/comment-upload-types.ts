export type CommentUploadOption = {
  id: string;
  filename: string;
  size?: number;
};

export type CommentUploadSummary = {
  maxFileSizeBytes: number;
  quotaBytes: number;
  usedBytes: number;
};
