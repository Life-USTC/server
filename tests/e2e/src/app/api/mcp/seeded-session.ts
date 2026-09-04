/**
 * Shared arrange/cleanup for MCP seeded-tool E2E shards.
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import {
  type BusPreference,
  createAuthenticatedMcpClient,
  getCurrentSubscriptionSectionIds,
  getSeedSectionId,
  replaceCalendarSubscription,
  saveBusPreference,
} from "./helpers";

export type SeededMcpSession = Awaited<
  ReturnType<typeof createAuthenticatedMcpClient>
> & {
  originalBusPreference: BusPreference | undefined;
  originalSectionIds: number[];
  seedSectionId: number;
};

export async function openSeededMcpSession(
  page: Page,
  request: Page["request"],
): Promise<SeededMcpSession> {
  const mcp = await createAuthenticatedMcpClient(page, request);

  const originalBusPreferenceResponse = await page.request.get(
    "/api/workspace/bus-preferences",
  );
  expect(originalBusPreferenceResponse.status()).toBe(200);
  const originalBusPreference = (
    (await originalBusPreferenceResponse.json()) as {
      preference?: BusPreference;
    }
  ).preference;

  const originalSectionIds = await getCurrentSubscriptionSectionIds(
    page.request,
  );
  const seedSectionId = await getSeedSectionId(page.request);

  await saveBusPreference(page.request, {
    preferredOriginCampusId: 1,
    preferredDestinationCampusId: 4,
    showDepartedTrips: true,
  });
  await replaceCalendarSubscription(page.request, [seedSectionId]);

  return {
    ...mcp,
    originalBusPreference,
    originalSectionIds,
    seedSectionId,
  };
}

export async function closeSeededMcpSession(
  page: Page,
  session: SeededMcpSession,
  options?: { createdHomeworkId?: string | null },
) {
  try {
    if (options?.createdHomeworkId) {
      await page.request.delete(
        `/api/community/section-homeworks/${options.createdHomeworkId}`,
      );
    }
    await replaceCalendarSubscription(page.request, session.originalSectionIds);
    await saveBusPreference(page.request, session.originalBusPreference ?? {});
  } finally {
    await session.close();
  }
}
