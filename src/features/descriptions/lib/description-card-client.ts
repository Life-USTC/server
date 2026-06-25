import { apiClient } from "@/lib/api/client";
import type {
  DescriptionPayload,
  DescriptionTargetType,
} from "./description-card-types";

export async function fetchDescriptionPayload(input: {
  targetId: number | string;
  targetType: DescriptionTargetType;
}) {
  const result = await apiClient.GET<DescriptionPayload>("/api/descriptions", {
    params: {
      query: {
        targetId: String(input.targetId),
        targetType: input.targetType,
      },
    },
  });
  return {
    ok: result.response.ok,
    payload: result.data ?? null,
  };
}

export async function saveDescriptionPayload(input: {
  content: string;
  targetId: number | string;
  targetType: DescriptionTargetType;
}) {
  const result = await apiClient.POST("/api/descriptions", {
    body: input,
  });
  return result.response;
}
