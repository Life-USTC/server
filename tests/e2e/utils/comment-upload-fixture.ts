import { mergeTests } from "@playwright/test";
import type {
  CommentAttachment,
  Upload,
  UploadPending,
} from "../../../src/generated/prisma-node/client";
import { test as storageTest } from "../../integration/rest/uploads/_fixture";
import { test as communityTest } from "./community-fixture";
import { withE2ePrisma } from "./e2e-db/prisma";

type UploadSnapshot = {
  uploads: Upload[];
  pending: UploadPending[];
  attachments: CommentAttachment[];
  objects: { key: string; body: number[] }[];
};
type UploadStep = { path: string; status: number; state: UploadSnapshot };

const combined = mergeTests(communityTest, storageTest);
export const test = combined.extend<{
  upload: {
    prefix: string;
    steps: UploadStep[];
    observe: () => Promise<UploadSnapshot>;
  };
}>({
  // The storage observer accepts UUID-owned prefixes. Reuse the native REST
  // actor lifecycle and install its real signed session in this browser.
  account: async ({ createActor, page }, use) => {
    const actor = await createActor();
    const account = await withE2ePrisma((db) =>
      db.user.update({
        where: { id: actor.id },
        data: { username: `cu${actor.id.replaceAll("-", "").slice(0, 17)}` },
      }),
    );
    try {
      await page
        .context()
        .addCookies((await actor.request.storageState()).cookies);
      await use(account);
    } finally {
      await page.close();
    }
  },
  upload: async (
    { account, community: _community, page, uploadBucket: bucket },
    use,
  ) => {
    // Ownership exists before the browser can initialize an upload; no response
    // ID is needed to remove pending reservations or partially uploaded objects.
    const prefix = `uploads/${account.id}/`;
    const steps: UploadStep[] = [];
    const pendingRequests = new Set<Promise<void>>();
    let closing = false;
    const objectKeys = async () => {
      const keys: string[] = [];
      let cursor: string | undefined;
      do {
        const result = await bucket.list({
          prefix,
          ...(cursor ? { cursor } : {}),
        });
        keys.push(...result.objects.map((object) => object.key));
        cursor = result.truncated ? result.cursor : undefined;
      } while (cursor);
      return keys;
    };
    const observe = async (): Promise<UploadSnapshot> => {
      const data = await withE2ePrisma(async (db) => ({
        uploads: await db.upload.findMany({ where: { userId: account.id } }),
        pending: await db.uploadPending.findMany({
          where: { userId: account.id },
        }),
        attachments: await db.commentAttachment.findMany({
          where: { upload: { userId: account.id } },
        }),
      }));
      const objects = [];
      for (const key of await objectKeys()) {
        const object = await bucket.get(key);
        if (!object)
          throw new Error(`Owned object ${key} disappeared during observation`);
        objects.push({ key, body: Array.from(object.body) });
      }
      return { ...data, objects };
    };
    const cleanup = async () => {
      closing = true;
      const results: PromiseSettledResult<unknown>[] = await Promise.allSettled(
        page
          .context()
          .pages()
          .map((openPage) => openPage.close()),
      );
      results.push(...(await Promise.allSettled([...pendingRequests])));
      results.push(...(await Promise.allSettled([page.context().close()])));
      results.push(
        ...(await Promise.allSettled([
          (async () => {
            await Promise.all(
              (await objectKeys()).map((key) => bucket.delete(key)),
            );
          })(),
          withE2ePrisma((db) =>
            db.$transaction([
              db.uploadPending.deleteMany({ where: { userId: account.id } }),
              db.upload.deleteMany({ where: { userId: account.id } }),
            ]),
          ),
        ])),
      );
      const errors = results.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (errors.length)
        throw new AggregateError(errors, "Owned comment upload cleanup failed");
    };
    try {
      await page.route(
        /\/api\/workspace\/uploads(?:\/(?:object|complete))?(?:\?|$)/,
        async (route) => {
          if (!["POST", "PUT"].includes(route.request().method()))
            return route.continue();
          const completion = (async () => {
            try {
              // Await the real Worker response before exposing it to the UI. This
              // captures each persisted phase and lets teardown drain server writes
              // even if the browser is interrupted before receiving a response.
              const response = await route.fetch();
              steps.push({
                path: new URL(route.request().url()).pathname,
                status: response.status(),
                state: await observe(),
              });
              await route.fulfill({ response });
            } catch (error) {
              if (!closing) throw error;
            }
          })();
          pendingRequests.add(completion);
          try {
            await completion;
          } finally {
            pendingRequests.delete(completion);
          }
        },
      );
      await use({ prefix, steps, observe });
    } finally {
      await cleanup();
    }
  },
});
