import { expect, type Page } from "@playwright/test";
import { resolveSeedSectionMatches } from "./seed-lookups";

export { resolveSeedSectionId } from "./seed-lookups";

export async function ensureSeedSectionSubscription(page: Page) {
  const sectionIds = (await resolveSeedSectionMatches(page)).map(
    (section) => section.id,
  );
  const subscriptionResponse = await page.request.post(
    "/api/calendar-subscriptions",
    { data: { sectionIds } },
  );
  expect(subscriptionResponse.status()).toBe(200);
}
