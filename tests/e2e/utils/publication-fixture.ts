import { expect } from "@playwright/test";
import {
  arrangePublicationFixture,
  type PublicationFixture,
  type PutPublicationObject,
} from "./e2e-db/publications";
import { test as workerTest } from "./owned-page";

type PublicationObjects = {
  put: PutPublicationObject;
  get: (key: string) => Promise<Buffer | null>;
};

export const publicationStorageTest = workerTest.extend<{
  publicationObjects: PublicationObjects;
  browseRun: (work: () => Promise<void>) => Promise<void>;
}>({
  browseRun: async ({ pageRun }, use) => {
    await use((work) =>
      pageRun(work, async (_response, request) => {
        throw new Error(
          `Read-only browse workflow submitted ${request.method()} ${new URL(request.url()).pathname}`,
        );
      }),
    );
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
