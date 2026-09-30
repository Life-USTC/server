import type { APIResponse, Request } from "@playwright/test";
import { withBrowserWorkflow } from "./browser-workflow";
import { test as workerTest } from "./owned-worker";
import { withSettledPageWrites } from "./settled-page-writes";

type ObserveWrite = (response: APIResponse, request: Request) => Promise<void>;

/** Own a primary-page transition and its submitted writes. The scenario supplies
 * its response and persisted-state assertions; the existing wrappers retain the
 * actual callback and close the page before its private Worker is released. */
export const test = workerTest.extend<{
  pageRun: (work: () => Promise<void>, observeWrite: ObserveWrite) => Promise<void>;
}>({
  pageRun: async ({ page, isolatedWorker, run }, use) => {
    await withBrowserWorkflow(page, async (workflow) => {
      await use((work, observeWrite) =>
        workflow.run(() =>
          run(() => withSettledPageWrites(
            page,
            (url) => url.origin === isolatedWorker.origin,
            () => workflow.body(work),
            observeWrite,
          )),
        ),
      );
    });
  },
});
