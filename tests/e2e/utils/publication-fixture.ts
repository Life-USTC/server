import { expect, type Request } from "@playwright/test";
import { withBrowserWorkflow } from "./browser-workflow";
import {
  arrangePublicationFixture,
  type PublicationFixture,
  type PutPublicationObject,
} from "./e2e-db/publications";
import { test as workerTest } from "./owned-worker";

type PublicationObjects = {
  put: PutPublicationObject;
  get: (key: string) => Promise<Buffer | null>;
};

export const publicationStorageTest = workerTest.extend<{
  publicationObjects: PublicationObjects;
  browseRun: (work: () => Promise<void>) => Promise<void>;
}>({
  browseRun: async ({ page, isolatedWorker, run }, use) => {
    const writes: Promise<void>[] = [];
    const errors: unknown[] = [];
    const observeWrite = (request: Request) => {
      const url = new URL(request.url());
      if (
        url.origin !== isolatedWorker.origin ||
        ["GET", "HEAD"].includes(request.method())
      )
        return;
      errors.push(
        new Error(
          `Read-only browse workflow submitted ${request.method()} ${url.pathname}`,
        ),
      );
      // Observe the original browser request through its response stream. Never
      // proxy/replay an unexpected write or close its page before its EOF.
      const completion = run(async () => {
        const response = await request.response();
        if (!response)
          throw new Error(
            `Unexpected browse write failed: ${request.failure()?.errorText}`,
          );
        const failure = await response.finished();
        if (failure) throw failure;
      }).catch((error) => {
        errors.push(error);
      });
      writes.push(completion);
    };
    page.on("request", observeWrite);
    try {
      await withBrowserWorkflow(page, async (workflow) => {
        await use((work) =>
          workflow.run(() =>
            run(async () => {
              try {
                await workflow.body(work);
              } finally {
                // Routing disables Chromium's HTTP cache. Install admission control
                // only after browsing ends, preserving cache use across navigations.
                try {
                  await page.route(
                    (url) => url.origin === isolatedWorker.origin,
                    (route) => {
                      const completion = route
                        .abort("aborted")
                        .catch((error) => {
                          errors.push(error);
                        });
                      writes.push(completion);
                      return completion;
                    },
                  );
                } catch (error) {
                  errors.push(error);
                }
                for (let index = 0; index < writes.length; index++)
                  await writes[index];
              }
            }),
          ),
        );
      });
    } catch (error) {
      errors.push(error);
    } finally {
      // Keep observation installed until the existing owner has closed the page
      // and joined the actual body, including submissions during interruption.
      page.off("request", observeWrite);
      for (let index = 0; index < writes.length; index++) await writes[index];
    }
    if (errors.length)
      throw new AggregateError(errors, "Read-only browse workflow failed");
  },
  publicationObjects: async ({ request }, use) => {
    const path = "/__test/storage/publications";
    const headers = { "x-test-storage-secret": "local-test-storage-observer" };
    await use({
      async put(key, body, contentType) {
        const response = await request.put(path, {
          params: { key },
          data: body,
          headers: { ...headers, "content-type": contentType },
        });
        expect(response.status(), await response.text()).toBe(204);
      },
      async get(key) {
        const response = await request.get(path, { params: { key }, headers });
        if (response.status() === 404) return null;
        expect(response.status(), await response.text()).toBe(200);
        return response.body();
      },
    });
  },
});

export const test = publicationStorageTest.extend<{
  publication: PublicationFixture;
}>({
  publication: [
    async ({ isolatedWorker, publicationObjects, run }, use) => {
      // Identical keys and URLs are intentional: each native owner already
      // owns its database, R2, Worker and caches before arrangement starts.
      await use(
        await run(() =>
          arrangePublicationFixture(
            isolatedWorker.database.owner,
            publicationObjects.put,
            "private-publication",
          ),
        ),
      );
    },
    { auto: true },
  ],
});
