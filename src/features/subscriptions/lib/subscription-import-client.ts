import type * as z from "zod";
import { extractSectionCodeTokens } from "@/features/catalog/lib/section-code-schema";
import { apiClient, apiErrorMessage } from "@/lib/api/client";
import {
  calendarSubscriptionBatchResponseSchema,
  calendarSubscriptionQueryResponseSchema,
} from "@/lib/api/schemas/misc-response-schema-core";

export function extractSubscriptionSectionCodes(value: string) {
  return extractSectionCodeTokens(value);
}

function validatedPayload<T>(
  schema: z.ZodType<T>,
  payload: unknown,
  errorMessage: string,
) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(errorMessage);
  }

  return parsed.data;
}

export async function matchSubscriptionSectionCodes({
  codes,
  fetchFailedMessage,
  semesterId,
}: {
  codes: string[];
  fetchFailedMessage: string;
  semesterId?: number;
}) {
  const result = await apiClient.POST("/api/workspace/subscriptions/query", {
    body: {
      codes,
      semesterId,
    },
  });
  if (!result.response.ok) {
    throw new Error(apiErrorMessage(result.error, fetchFailedMessage));
  }
  return validatedPayload(
    calendarSubscriptionQueryResponseSchema,
    result.data,
    fetchFailedMessage,
  );
}

export async function appendSubscribedSectionIds({
  importFailedMessage,
  selectedSectionIds,
}: {
  importFailedMessage: string;
  selectedSectionIds: number[];
}) {
  if (selectedSectionIds.length === 0) {
    return 0;
  }

  const result = await apiClient.POST("/api/workspace/subscriptions/batch", {
    body: { action: "add", sectionIds: selectedSectionIds },
  });
  if (!result.response.ok) {
    throw new Error(apiErrorMessage(result.error, importFailedMessage));
  }
  const data = validatedPayload(
    calendarSubscriptionBatchResponseSchema,
    result.data,
    importFailedMessage,
  );

  return data.addedCount;
}

export async function removeSubscribedSectionIds({
  errorMessage,
  sectionIds,
}: {
  errorMessage: string;
  sectionIds: number[];
}) {
  if (sectionIds.length === 0) {
    return;
  }

  const result = await apiClient.POST("/api/workspace/subscriptions/batch", {
    body: { action: "remove", sectionIds },
  });
  if (!result.response.ok) {
    throw new Error(apiErrorMessage(result.error, errorMessage));
  }
  validatedPayload(
    calendarSubscriptionBatchResponseSchema,
    result.data,
    errorMessage,
  );
}
