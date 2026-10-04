import { expect } from "@playwright/test";
import { createDeferred } from "../../../../shared/deferred";
import { withHomeworkEffects } from "../../../utils/homework-effects";
import { test } from "../../../utils/owned-worker";

test("homework finalization closes retired static reads before checking their terminal", async ({
  page,
  isolatedWorker,
  run,
}) => {
  await run(async () => {
    const account = await isolatedWorker.createActor();
    const arrived = createDeferred();
    const release = createDeferred();
    const assetPath = "/images/ustc_favicon.png";
    const routes: Promise<void>[] = [];
    let responseSettled = false;
    let observation: Promise<void> | undefined;
    try {
      await withHomeworkEffects(
        {
          page,
          isolatedWorker,
          account,
          calendarMessages: [],
          observeReads: true,
        },
        async ({ onClosing }) => {
          expect((await page.goto("/api/health"))?.status()).toBe(200);
          // Hold a genuine static response across document replacement. No
          // Worker request or successful browser terminal is manufactured.
          await page.route(`**${assetPath}`, (route) => {
            const operation = (async () => {
              const response = await route.fetch();
              expect(response.status()).toBe(200);
              await response.body();
              arrived.resolve();
              await release.promise;
              await route.fulfill({ response });
            })();
            routes.push(operation);
            void operation.catch(() => undefined);
            return operation;
          });
          const requested = page.waitForRequest(`**${assetPath}`);
          await page.evaluate((path) => {
            void fetch(path).catch(() => undefined);
          }, assetPath);
          const request = await requested;
          observation = request.response().then(
            () => {
              responseSettled = true;
            },
            () => {
              responseSettled = true;
            },
          );
          await arrived.promise;
          expect((await page.goto("/api/health?replacement"))?.status()).toBe(
            200,
          );
          expect(responseSettled).toBe(false);
          onClosing(release.resolve);
        },
      );
      expect(page.isClosed()).toBe(true);
      await observation;
      expect(responseSettled).toBe(true);
    } finally {
      release.resolve();
      await Promise.all(routes);
      await observation;
    }
  });
});
