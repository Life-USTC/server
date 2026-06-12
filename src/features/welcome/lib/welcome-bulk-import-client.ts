import { matchSectionCodesResponseSchema } from "@/lib/api/schemas/misc-response-schema-core";

export function extractSectionCodes(value: string) {
  return Array.from(new Set(value.match(/[A-Z0-9_.-]+\.[A-Z0-9]{2}/g) ?? []));
}

export async function matchWelcomeSectionCodes({
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
  const rawPayload = await response.json();
  if (!response.ok) {
    throw new Error(rawPayload?.error ?? fetchFailedMessage);
  }
  const payload = matchSectionCodesResponseSchema.safeParse(rawPayload);
  if (!payload.success) {
    throw new Error(fetchFailedMessage);
  }
  return payload.data;
}

export async function fetchCurrentSubscribedSectionIds(
  fetchFailedMessage: string,
) {
  const response = await fetch("/api/calendar-subscriptions/current");
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error ?? fetchFailedMessage);
  }
  return (
    payload.subscription?.sections?.map(
      (section: { id: number }) => section.id,
    ) ?? []
  );
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
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error ?? importFailedMessage);
  }
}
