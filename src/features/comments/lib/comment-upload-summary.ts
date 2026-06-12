import { uploadsListResponseSchema } from "@/lib/api/schemas/uploads-response-schemas";
import { uploadSummaryFromResponse } from "./comment-upload-request";

export async function loadCommentUploadSummary(errorMessage: string) {
  const response = await fetch("/api/uploads");
  if (!response.ok) throw new Error(errorMessage);
  const parsed = uploadsListResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error(errorMessage);
  return uploadSummaryFromResponse(parsed.data);
}
