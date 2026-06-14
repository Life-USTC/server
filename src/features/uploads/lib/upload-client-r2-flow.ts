import { apiClient } from "@/lib/api/client";
import {
  extractUploadErrorCode,
  UploadFlowError,
} from "./upload-client-errors";
import type {
  UploadCompleteResponse,
  UploadCreateResponse,
  UploadSummary,
} from "./upload-client-types";

export async function uploadFileWithR2<TUpload>({
  file,
  maxFileSizeBytes,
}: {
  file: File;
  maxFileSizeBytes?: number;
}): Promise<{
  upload: TUpload;
  summary: UploadSummary;
  uploadSession: UploadCreateResponse;
}> {
  if (maxFileSizeBytes && file.size > maxFileSizeBytes) {
    throw new UploadFlowError("File too large");
  }

  const {
    data: uploadSession,
    error: uploadSessionError,
    response: uploadSessionResponse,
  } = await apiClient.POST<UploadCreateResponse>("/api/uploads", {
    body: {
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
    },
  });

  if (!uploadSessionResponse.ok || !uploadSession) {
    const errorCode = extractUploadErrorCode(uploadSessionError);
    throw new UploadFlowError(errorCode ?? "Upload session failed");
  }

  const uploadResponse = await fetch(uploadSession.url, {
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
        key: uploadSession.key,
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
    maxFileSizeBytes: uploadSession.maxFileSizeBytes,
    quotaBytes: completeData.quotaBytes,
    usedBytes: completeData.usedBytes,
  };

  return {
    upload: completeData.upload as TUpload,
    summary,
    uploadSession,
  };
}
