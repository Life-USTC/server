export type UploadCreateInput = {
  contentType: string;
  filename: string;
  size: number;
};

export type UploadCompleteInput = {
  contentType?: string | null;
  filename: string;
  key: string;
};
