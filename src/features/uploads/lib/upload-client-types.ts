export type UploadSummary = {
  maxFileSizeBytes: number;
  quotaBytes: number;
  usedBytes: number;
};

export type UploadPresignResponse = {
  key: string;
  url: string;
  maxFileSizeBytes: number;
  quotaBytes: number;
  usedBytes: number;
};

export type UploadCompleteResponse<TUpload> = {
  upload: TUpload;
  usedBytes: number;
  quotaBytes: number;
};
