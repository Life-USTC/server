import { apiClient } from "@/lib/api/client";
import { uploadsListResponseSchema } from "@/lib/api/schemas/uploads-response-schemas";
import { uploadSummaryFromResponse } from "./comment-upload-request";

export async function loadCommentUploadSummary(errorMessage: string) {
  const result = await apiClient.GET("/api/workspace/uploads");
  if (!result.response.ok) throw new Error(errorMessage);
  const parsed = uploadsListResponseSchema.safeParse(result.data);
  if (!parsed.success) throw new Error(errorMessage);
  return uploadSummaryFromResponse(parsed.data.meta);
}
