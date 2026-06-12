import { getUploadEnv } from "@/app-env";

const DEFAULT_UPLOAD_QUOTA_MB = 1024;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

const quotaMb = getUploadEnv().UPLOAD_TOTAL_QUOTA_MB ?? DEFAULT_UPLOAD_QUOTA_MB;

export const uploadConfig = {
  maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
  totalQuotaBytes: quotaMb * 1024 * 1024,
};
