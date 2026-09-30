import { expect } from "@playwright/test";
import type { User } from "../../../src/generated/prisma-node/client";
import {
  type CommunityChecks,
  type CommunityFlow,
  withCommunityFlow,
} from "./community-flow";
import { test as isolatedWorkerTest } from "./owned-page";

type AdminWrite = readonly [
  method: string,
  path: string | RegExp,
  status: number,
];

/** Explicit browser and native method/status contracts for an admin scenario. */
export function adminWriteChecks(
  browser: readonly AdminWrite[],
  native: readonly AdminWrite[] = browser,
  verifyState: () => Promise<void> = async () => {},
): CommunityChecks {
  const writes: AdminWrite[] = [];
  const expected = (plan: readonly AdminWrite[]) =>
    plan.map(([method, path, status]) => [
      method,
      typeof path === "string" ? path : expect.stringMatching(path),
      status,
    ]);
  return {
    async verifyBrowserWrite(response, incoming) {
      writes.push([
        incoming.method(),
        new URL(incoming.url()).pathname,
        response.status(),
      ]);
      expect(writes[writes.length - 1]).toEqual(
        expected(browser)[writes.length - 1],
      );
      await response.body();
    },
    async verifyTransport({ producer, sdkRequests }) {
      expect(sdkRequests).toEqual([]);
      expect(writes).toEqual(expected(browser));
      expect(
        producer.requests
          .filter(({ value }) => !["GET", "HEAD"].includes(value.method))
          .map(({ value, result }) => [value.method, value.path, result]),
      ).toEqual(expected(native));
    },
    verifyState,
  };
}

export const test = isolatedWorkerTest.extend<{
  admin: User & { username: string };
  account: User;
  adminFlow: CommunityFlow;
}>({
  admin: async ({ isolatedWorker, page, run }, use) => {
    await use(
      await run(async () => {
        const actor = await isolatedWorker.createActor({ isAdmin: true });
        await page.context().addCookies([actor.cookie]);
        const user = await isolatedWorker.database.owner.user.findUniqueOrThrow(
          { where: { id: actor.id } },
        );
        if (!user.username)
          throw new Error("The private actor must have a username");
        return { ...user, username: user.username };
      }),
    );
  },
  account: async ({ isolatedWorker, page, run }, use) => {
    await use(
      await run(async () => {
        const actor = await isolatedWorker.createActor();
        await page.context().addCookies([actor.cookie]);
        return isolatedWorker.database.owner.user.findUniqueOrThrow({
          where: { id: actor.id },
        });
      }),
    );
  },
  adminFlow: async (
    { page, browser, request: observer, isolatedWorker, admin, run },
    use,
    testInfo,
  ) => {
    await run(() =>
      withCommunityFlow(
        { page, browser, observer, isolatedWorker, account: admin, testInfo },
        use,
      ),
    );
  },
});
