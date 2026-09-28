import { expect } from "@playwright/test";
import {
  arrangePublicationFixture,
  type PublicationFixture,
  type PutPublicationObject,
} from "./e2e-db/publications";
import { test as workerTest } from "./isolated-worker";

type PublicationObjects = {
  put: PutPublicationObject;
  get: (key: string) => Promise<Buffer | null>;
};

export const test = workerTest.extend<{
  publication: PublicationFixture;
  publicationObjects: PublicationObjects;
}>({
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
  publication: [
    async ({ isolatedWorker, publicationObjects }, use) => {
      // Identical keys and URLs are intentional: each native owner already
      // owns its database, R2, Worker and caches before arrangement starts.
      await use(
        await arrangePublicationFixture(
          isolatedWorker.database.owner,
          publicationObjects.put,
          "private-publication",
        ),
      );
    },
    { auto: true },
  ],
});
