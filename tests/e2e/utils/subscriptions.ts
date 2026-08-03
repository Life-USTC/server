import { type APIRequestContext, expect, type Page } from "@playwright/test";
import { resolveSeedSectionMatches } from "./seed-lookups";

export { resolveSeedSectionId } from "./seed-lookups";

function getRequestFromSubscriptionSource(source: APIRequestContext | Page) {
  return "request" in source ? source.request : source;
}

export async function ensureSeedSectionSubscription(
  source: APIRequestContext | Page,
) {
  const sectionIds = (await resolveSeedSectionMatches(source)).map(
    (section) => section.id,
  );
  const subscriptionResponse = await getRequestFromSubscriptionSource(
    source,
  ).post("/api/workspace/subscriptions", { data: { sectionIds } });
  expect(subscriptionResponse.status()).toBe(200);
}
