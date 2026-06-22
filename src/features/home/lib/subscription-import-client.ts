import type * as z from "zod";
import { extractApiErrorMessage } from "@/lib/api/client";
import {
  calendarSubscriptionCreateResponseSchema,
  currentCalendarSubscriptionResponseSchema,
  matchSectionCodesResponseSchema,
} from "@/lib/api/schemas/misc-response-schema-core";

const SECTION_CODE_PATTERN = /[A-Z0-9_.-]+\.[A-Z0-9]{2}/g;

export function extractSubscriptionSectionCodes(value: string) {
  return Array.from(new Set(value.match(SECTION_CODE_PATTERN) ?? []));
}

async function readJsonPayload(response: Response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function assertOkResponse(
  response: Response,
  payload: unknown,
  errorMessage: string,
) {
  if (!response.ok) {
    throw new Error(extractApiErrorMessage(payload) ?? errorMessage);
  }
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
  const response = await fetch("/api/sections/match-codes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      codes,
      semesterId,
    }),
  });
  const payload = await readJsonPayload(response);
  assertOkResponse(response, payload, fetchFailedMessage);
  return validatedPayload(
    matchSectionCodesResponseSchema,
    payload,
    fetchFailedMessage,
  );
}

export async function fetchCurrentSubscribedSectionIds(
  fetchFailedMessage: string,
) {
  const response = await fetch("/api/calendar-subscriptions/current");
  const payload = await readJsonPayload(response);
  assertOkResponse(response, payload, fetchFailedMessage);
  const data = validatedPayload(
    currentCalendarSubscriptionResponseSchema,
    payload,
    fetchFailedMessage,
  );

  return data.subscription?.sections.map((section) => section.id) ?? [];
}

export async function updateSubscribedSectionIds(
  sectionIds: number[],
  importFailedMessage: string,
) {
  const response = await fetch("/api/calendar-subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sectionIds }),
  });
  const payload = await readJsonPayload(response);
  assertOkResponse(response, payload, importFailedMessage);
  validatedPayload(
    calendarSubscriptionCreateResponseSchema,
    payload,
    importFailedMessage,
  );
}

export async function appendSubscribedSectionIds({
  fetchFailedMessage,
  importFailedMessage,
  selectedSectionIds,
}: {
  fetchFailedMessage: string;
  importFailedMessage: string;
  selectedSectionIds: number[];
}) {
  const currentSectionIds =
    await fetchCurrentSubscribedSectionIds(fetchFailedMessage);
  const nextSectionIds = Array.from(
    new Set([...currentSectionIds, ...selectedSectionIds]),
  );

  await updateSubscribedSectionIds(nextSectionIds, importFailedMessage);

  return selectedSectionIds.length;
}
