import { expect, type Request } from "@playwright/test";
import { createDeferred } from "../../../../shared/deferred";
import { calendarLifecycleBarrier } from "../../../utils/calendar-lifecycle-barrier";
import { test } from "../../../utils/private-calendar-fixture";

const calendarPath = "/api/workspace/calendar/events";

test("calendar closure excludes new browser reads while draining their real Worker effects", async ({
  calendar,
  calendarProtocolRun,
  isolatedWorker,
  page,
  request,
}) => {
  const barrier = await calendarLifecycleBarrier(isolatedWorker.database);
  const originalClose = page.close;
  const originalGet = request.get;
  const draining = createDeferred();
  let late: Request | undefined;
  let workflow: Promise<void> | undefined;
  let settled = false;
  let verified = false;
  try {
    await barrier.blockRead(calendar.users[0].id, calendar.todo.id, false);
    const session = await isolatedWorker.createSession(calendar.users[0].id);
    await page.context().addCookies([session.cookie]);
    request.get = (url, options) => {
      const response = originalGet.call(request, url, options);
      if (url.startsWith("/__test/community-effects?")) draining.resolve();
      return response;
    };
    page.close = async (options) => {
      if (!late && !page.isClosed()) {
        // Force the CI ordering: the body and active-read drain finished, but
        // a component dispatches a new fetch as native page closure begins.
        const requested = page.waitForRequest(
          (incoming) => new URL(incoming.url()).pathname === calendarPath,
        );
        void requested.catch(() => undefined);
        await page.evaluate((url) => {
          void fetch(url).catch(() => undefined);
        }, `${calendarPath}?dateFrom=${calendar.date}&dateTo=${calendar.date}&page=1&pageSize=100`);
        late = await requested;
        await barrier.waitForBlocked(/SELECT[\s\S]*"Todo"/);
      }
      // The real browser closes while the real Worker still owns blocked SQL.
      await originalClose.call(page, options);
    };
    workflow = calendarProtocolRun(async () => {
      await page.goto("/api/health");
      return {
        async verifyTransport({ effects, sdkRequests }) {
          const reads = effects.requests.filter(
            (incoming) => incoming.value.path === calendarPath,
          );
          expect(reads).toEqual([
            {
              outcome: "fulfilled",
              value: {
                method: "GET",
                path: calendarPath,
              },
              result: 200,
            },
          ]);
          expect(sdkRequests).toEqual([]);
          expect(effects.messages).toEqual([]);
          expect(effects.purges).toEqual([]);
          expect(effects.backgroundErrors).toEqual([]);
        },
        async verifyState() {
          expect(
            await isolatedWorker.database.owner.todo.count({
              where: { id: calendar.todo.id, userId: calendar.users[0].id },
            }),
          ).toBe(1);
          verified = true;
        },
      };
    });
    const outcome = workflow.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await Promise.race([
      draining.promise,
      workflow.then(() => {
        throw new Error("Calendar workflow returned before producer drain");
      }),
    ]);
    expect(page.isClosed()).toBe(true);
    expect(late).toBeDefined();
    await barrier.assertStillBlocked();
    const health = await originalGet.call(request, "/api/health");
    expect(health.status()).toBe(200);
    expect(await health.text()).toBe("ok\n");
    expect(settled).toBe(false);
    await barrier.release();
    await workflow;
    await outcome;
    expect(verified).toBe(true);
    await barrier.assertBackendDisconnected();
  } finally {
    page.close = originalClose;
    request.get = originalGet;
    await barrier.release();
    await workflow?.catch(() => undefined);
    await barrier.close();
  }
});
