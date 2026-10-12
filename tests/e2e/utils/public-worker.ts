import { type CommunityFlow, withCommunityFlow } from "./community-flow";
import { test as workerTest } from "./owned-worker";

/** Anonymous requests can populate SSR caches and schedule background work.
 * Each scenario owns its actual Worker/storage and independently drains effects. */
export const test = workerTest.extend<{ publicFlow: CommunityFlow }>({
  publicFlow: async (
    { page, browser, request: observer, isolatedWorker, run },
    use,
  ) => {
    await run(() =>
      withCommunityFlow(
        { page, browser, observer, isolatedWorker, account: null },
        use,
      ),
    );
  },
});
