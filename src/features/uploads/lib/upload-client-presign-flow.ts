import { apiClient } from "@/lib/api/client";
import {
  extractUploadErrorCode,
  UploadFlowError,
} from "./upload-client-errors";
import type {
  UploadCompleteResponse,
  UploadPresignResponse,
  UploadSummary,
} from "./upload-client-types";

export async function uploadFileWithPresign<TUpload>({
  file,
  maxFileSizeBytes,
}: {
  file: File;
  maxFileSizeBytes?: number;
}): Promise<{
  upload: TUpload;
  summary: UploadSummary;
  presign: UploadPresignResponse;
}> {
  if (maxFileSizeBytes && file.size > maxFileSizeBytes) {
    throw new UploadFlowError("File too large");
  }

  const {
    data: presignData,
    error: presignError,
    response: presignResponse,
  } = await apiClient.POST<UploadPresignResponse>("/api/uploads", {
    body: {
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
    },
  });

  if (!presignResponse.ok || !presignData) {
    const errorCode = extractUploadErrorCode(presignError);
    throw new UploadFlowError(errorCode ?? "Presign failed");
  }

  const uploadResponse = await fetch(presignData.url, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
  });

  if (!uploadResponse.ok) {
    throw new UploadFlowError("Upload failed");
  }

  const {
    data: completeData,
    error: completeError,
    response: completeResponse,
  } = await apiClient.POST<UploadCompleteResponse<TUpload>>(
    "/api/uploads/complete",
    {
      body: {
        key: presignData.key,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
      },
    },
  );

  if (!completeResponse.ok || !completeData) {
    const errorCode = extractUploadErrorCode(completeError);
    throw new UploadFlowError(errorCode ?? "Finalize failed");
  }

  const summary: UploadSummary = {
    maxFileSizeBytes: presignData.maxFileSizeBytes,
    quotaBytes: completeData.quotaBytes,
    usedBytes: completeData.usedBytes,
  };

  return {
    upload: completeData.upload as TUpload,
    summary,
    presign: presignData,
  };
}
