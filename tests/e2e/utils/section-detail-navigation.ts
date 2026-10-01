import { expect, type Page, type Request } from "@playwright/test";
import { waitForUiSettled } from "./page-ready";
import type { PreferenceFlow } from "./preference-flow";

/** Observe section viewer replacement in the explicit catalog navigation scenarios.
 * Register before clicking; wait after the caller's URL/content assertions. Each
 * caller arranges a section without comments, so its empty panel is required. */
export function observeSectionDetailNavigation(
  page: Page,
  owner: Pick<PreferenceFlow, "expectReadCancellation" | "onClosing">,
  sectionJwId: number,
) {
  const viewerPath = `/_internal/catalog/sections/${sectionJwId}/viewer`;
  const viewerRequests: Request[] = [];
  const observeViewer = (request: Request) => {
    if (
      request.method() !== "GET" ||
      new URL(request.url()).pathname !== viewerPath
    )
      return;
    viewerRequests.push(request);
    // Shell refresh replaces the first detail controller during SPA navigation.
    // The reader requires this exact request's native abort terminal.
    if (viewerRequests.length === 1)
      owner.expectReadCancellation(page, request);
  };
  page.on("request", observeViewer);
  owner.onClosing(() => page.off("request", observeViewer));

  return async function expectSectionDetailReady() {
    try {
      await expect.poll(() => viewerRequests.length).toBe(2);
      const successor = await viewerRequests[1].response();
      expect(successor?.status()).toBe(200);
      await successor?.body();
      // URL and SSR shell precede lazy detail panels. Keep admission open until
      // the final panel and its independently arranged empty state are visible.
      await expect(
        page.locator("[data-detail-scroll-container]"),
      ).toHaveAttribute("aria-busy", "false");
      await expect(
        page.locator('#comments [data-slot="empty-description"]'),
      ).toBeVisible();
      await waitForUiSettled(page);
      expect(viewerRequests).toHaveLength(2);
    } finally {
      page.off("request", observeViewer);
    }
  };
}
