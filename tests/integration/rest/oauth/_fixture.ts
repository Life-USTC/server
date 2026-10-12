import type { APIRequestContext } from "@playwright/test";
import { test as workerTest } from "../../../e2e/utils/owned-worker";
import type { TestPrismaClient } from "../../../shared/prisma";

export type OAuthState = {
  db: TestPrismaClient;
  userId: string;
  origin: string;
  request: APIRequestContext;
  session: APIRequestContext;
};

/** Provider caches and persisted grants belong to the same private Worker. */
export const test = workerTest.extend<{ oauth: OAuthState }>({
  oauth: async ({ isolatedWorker, request, run }, use) => {
    const actor = await run(() => isolatedWorker.createActor());
    await use({
      db: isolatedWorker.database.owner,
      userId: actor.id,
      origin: isolatedWorker.origin,
      request,
      session: actor.request,
    });
  },
});
