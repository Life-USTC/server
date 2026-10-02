import { expect, type Page, type Request } from "@playwright/test";
import { waitForUiSettled } from "./page-ready";
import type { PreferenceFlow } from "./preference-flow";

/** Observe the section detail viewer read in the explicit catalog navigation
 * scenarios. Register before clicking; wait after the caller's URL assertions.
 * Each caller requires a successful viewer read and arranges a section without
 * comments, so its empty panel is required. */
export function observeSectionDetailNavigation(
  page: Page,
  owner: Pick<PreferenceFlow, "onClosing">,
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
  };
  page.on("request", observeViewer);
  owner.onClosing(() => page.off("request", observeViewer));

  return async function expectSectionDetailReady() {
    try {
      await expect.poll(() => viewerRequests.length).toBeGreaterThan(0);
      const viewerRequest = viewerRequests[viewerRequests.length - 1];
      const response = await viewerRequest.response();
      expect(response?.status()).toBe(200);
      await response?.body();
      // URL and SSR shell precede lazy detail panels. Keep admission open until
      // the final panel and its independently arranged empty state are visible.
      await expect(
        page.locator("[data-detail-scroll-container]"),
      ).toHaveAttribute("aria-busy", "false");
      await expect(
        page.locator('#comments [data-slot="empty-description"]'),
      ).toBeVisible();
      await waitForUiSettled(page);
    } finally {
      page.off("request", observeViewer);
    }
  };
}
