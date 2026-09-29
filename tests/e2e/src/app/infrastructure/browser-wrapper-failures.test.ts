import { stripVTControlCharacters } from "node:util";
import { expect, type Request, type Response } from "@playwright/test";
import { createDeferred } from "../../../../shared/deferred";
import { observeCalendarFinalization } from "../../../utils/calendar-finalization-observer";
import { calendarLifecycleBarrier } from "../../../utils/calendar-lifecycle-barrier";
import { test } from "../../../utils/calendar-presentation-fixture";
import { withHomeworkEffects } from "../../../utils/homework-effects";
import { createNativeBrowserSignal } from "../../../utils/native-browser-signal";

function errorsIn(error: unknown): unknown[] {
  return error instanceof AggregateError
    ? error.errors.flatMap(errorsIn)
    : [error];
}

test("retired native 500 rejects the wrapper and preserves the callback failure", async ({
  calendar,
  isolatedWorker,
  page,
  run,
}, testInfo) => {
  await run(async () => {
    const comment = await isolatedWorker.database.owner.comment.create({
      data: {
        body: "Native retired read failure",
        userId: calendar.users[0].id,
        sectionId: calendar.section.id,
      },
    });
    const path = "/api/community/comments/" + comment.id;
    const bodyError = new Error("Original retired-read callback failure");
    const bodyFinished = createDeferred();
    let bodyReached = false;
    const barrier = await calendarLifecycleBarrier(isolatedWorker.database);
    const finalization = observeCalendarFinalization(page, barrier);
    const browserOperations: Promise<unknown>[] = [];
    let workflow: Promise<void> | undefined;
    let settled = false;
    const browser: {
      outcome?: { response?: Response | null; error?: unknown };
    } = {};
    try {
      await barrier.blockCommentRead(comment.id, true);
      workflow = withHomeworkEffects(
        {
          page,
          isolatedWorker,
          account: calendar.users[0],
          sectionId: calendar.section.id,
          testInfo,
          calendarMessages: [],
          observeReads: true,
        },
        async ({ headers }) => {
          try {
            expect(
              (await page.goto("/api/health?source=retired500"))?.status(),
            ).toBe(200);
            const incoming = page.waitForRequest(
              (request) => new URL(request.url()).pathname === path,
            );
            browserOperations.push(incoming);
            void incoming.catch(() => undefined);
            await page.evaluate((path) => {
              void fetch(path).catch(() => undefined);
            }, path);
            const request = await incoming;
            // Observe the real Playwright promise; never replace its resolution.
            browserOperations.push(
              request.response().then(
                (response) => {
                  browser.outcome = { response };
                },
                (error) => {
                  browser.outcome = { error };
                },
              ),
            );
            await barrier.waitForBlocked(/SELECT[\s\S]*"Comment"/);
            expect(
              (await page.goto("/api/health?replacement=retired500"))?.status(),
            ).toBe(200);
            expect(browser.outcome).toBeUndefined();
            finalization.arm(
              "/__test/community-effects?id=" +
                headers["x-test-community-probe"],
            );
            bodyReached = true;
            throw bodyError;
          } finally {
            bodyFinished.resolve();
          }
        },
      );
      const outcome = workflow.then(
        () => {
          settled = true;
          return { error: undefined };
        },
        (error: unknown) => {
          settled = true;
          return { error };
        },
      );
      await Promise.race([
        bodyFinished.promise,
        outcome.then(() => {
          throw new Error("Wrapper settled before callback barrier");
        }),
      ]);
      if (!bodyReached) {
        await barrier.release();
        const failed = await outcome;
        throw (
          failed.error ?? new Error("Retired-read arrangement did not complete")
        );
      }
      await Promise.race([
        finalization.entered,
        outcome.then(() => {
          throw new Error("Wrapper settled before native drain");
        }),
      ]);
      const blocked = await finalization.assertPending();
      expect(settled).toBe(false);
      await barrier.release();
      const result = await outcome;
      expect(result.error).toBeInstanceOf(AggregateError);
      const failures = errorsIn(result.error);
      expect(failures).toContain(bodyError);
      const nativeFailure = failures.find(
        (error) =>
          error instanceof Error &&
          error.message.includes("Retired consumer GET " + path),
      );
      expect(nativeFailure).toBeInstanceOf(Error);
      // toPass wraps the failed native-status matcher after its deadline.
      // Preserve that original diagnostic and independently assert native500 below.
      const nativeMessage = stripVTControlCharacters(
        (nativeFailure as Error).message,
      );
      expect(nativeMessage).toContain("toBeLessThan");
      expect(nativeMessage).toMatch(/Expected:\s*<\s*400/);
      expect(nativeMessage).toMatch(/Received:\s*500/);
      expect(page.isClosed()).toBe(true);
      expect(browser.outcome?.response).toBeUndefined();
      expect(browser.outcome?.error).toBeInstanceOf(Error);
      expect(String(browser.outcome?.error)).toContain(
        "request.response: Target page, context or browser has been closed",
      );
      const producer = await finalization.result();
      expect(
        producer.requests.filter((request) => request.value.path === path),
      ).toEqual([
        expect.objectContaining({
          outcome: "fulfilled",
          value: expect.objectContaining({
            method: "GET",
            path,
            requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
          }),
          result: 500,
        }),
      ]);
      expect(producer.backgroundErrors).toEqual([]);
      expect(
        await isolatedWorker.database.owner.comment.findUnique({
          where: { id: comment.id },
        }),
      ).toEqual(comment);
      await barrier.assertBackendDisconnected();
      await testInfo.attach("retired-native500-complete", {
        body: JSON.stringify({
          ...barrier.identity,
          blocked,
          producer,
          pageClosed: page.isClosed(),
          originalCallbackErrorRetained: failures.includes(bodyError),
          browserReadError: String(browser.outcome?.error),
        }),
        contentType: "application/json",
      });
    } finally {
      try {
        await barrier.release();
      } finally {
        try {
          await Promise.allSettled([
            ...(workflow ? [workflow] : []),
            ...browserOperations,
          ]);
        } finally {
          finalization.restore();
          await barrier.close();
        }
      }
    }
  });
});

test("callback failure joins a native redirect successor admitted during finalization", async ({
  calendar,
  isolatedWorker,
  page,
  run,
}, testInfo) => {
  await run(async () => {
    const comment = await isolatedWorker.database.owner.comment.create({
      data: {
        body: "Native late redirect",
        userId: calendar.users[0].id,
        sectionId: calendar.section.id,
      },
    });
    const path = "/community/comments/" + comment.id;
    const destination = "/catalog/sections/" + calendar.section.jwId;
    const bodyError = new Error("Original late-redirect callback failure");
    const bodyFinished = createDeferred();
    let signal:
      | Awaited<ReturnType<typeof createNativeBrowserSignal>>
      | undefined;
    const probePath = "/api/health?unowned=late-redirect";
    let bodyReached = false;
    const barrier = await calendarLifecycleBarrier(isolatedWorker.database);
    const finalization = observeCalendarFinalization(page, barrier);
    const browserOperations: Promise<unknown>[] = [];
    let workflow: Promise<void> | undefined;
    const navigation: {
      root?: Request;
      successor?: Request;
      outcome?: { response?: Response | null; error?: unknown };
    } = {};
    let finalizing = false;
    let successorAfterFinalization = false;
    let settled = false;
    const onRequest = (request: Request) => {
      if (navigation.root && request.redirectedFrom() === navigation.root) {
        navigation.successor = request;
        successorAfterFinalization = finalizing;
      }
    };
    page.on("request", onRequest);
    try {
      const control = await createNativeBrowserSignal(calendar.origin);
      signal = control;
      await barrier.blockCommentRead(comment.id, false);
      workflow = withHomeworkEffects(
        {
          page,
          isolatedWorker,
          account: calendar.users[0],
          sectionId: calendar.section.id,
          testInfo,
          calendarMessages: [],
          observeReads: true,
        },
        async ({ headers }) => {
          try {
            expect(
              (await page.goto("/api/health?source=late-redirect"))?.status(),
            ).toBe(200);
            // Pre-register a genuine HTTP response signal before navigation.
            // Releasing the Node server response needs no browser evaluation.
            // Its distinct origin is outside the product read observer.
            await page.evaluate(
              ({ signalUrl, path }) => {
                void fetch(signalUrl, {
                  credentials: "omit",
                  cache: "no-store",
                })
                  .then((response) => {
                    if (!response.ok)
                      throw new Error("Native control signal failed");
                    return response.text();
                  })
                  .then(() => fetch(path))
                  .catch(() => undefined);
              },
              { signalUrl: control.url, path: probePath },
            );
            await expect.poll(() => control.received).toBe(1);
            expect(control.errors).toEqual([]);
            const incoming = page.waitForRequest(
              (request) => new URL(request.url()).pathname === path,
            );
            browserOperations.push(incoming);
            void incoming.catch(() => undefined);
            browserOperations.push(
              page.goto(path, { waitUntil: "commit" }).then(
                (response) => {
                  navigation.outcome = { response };
                },
                (error) => {
                  navigation.outcome = { error };
                },
              ),
            );
            navigation.root = await incoming;
            await barrier.waitForBlocked(/SELECT[\s\S]*"Comment"/);
            finalization.arm(
              "/__test/community-effects?id=" +
                headers["x-test-community-probe"],
            );
            bodyReached = true;
            throw bodyError;
          } finally {
            bodyFinished.resolve();
          }
        },
      );
      const outcome = workflow.then(
        () => {
          settled = true;
          return { error: undefined };
        },
        (error: unknown) => {
          settled = true;
          return { error };
        },
      );
      await Promise.race([
        bodyFinished.promise,
        outcome.then(() => {
          throw new Error("Wrapper settled before callback barrier");
        }),
      ]);
      if (!bodyReached) {
        control.release();
        await barrier.release();
        const failed = await outcome;
        throw (
          failed.error ??
          new Error("Late-redirect arrangement did not complete")
        );
      }
      // A fresh unrelated read is rejected only after admission closes. This
      // actual route abort proves finalization without a sleep or private flags.
      const rejected = page.waitForEvent("requestfailed", {
        predicate: (request) =>
          new URL(request.url()).pathname + new URL(request.url()).search ===
          probePath,
      });
      browserOperations.push(rejected);
      void rejected.catch(() => undefined);
      control.release();
      expect((await rejected).failure()?.errorText).toBe("net::ERR_ABORTED");
      expect(control.pending).toBe(0);
      expect(control.received).toBe(1);
      expect(control.completed).toBe(1);
      expect(control.errors).toEqual([]);
      finalizing = true;
      const blocked = await barrier.assertStillBlocked();
      expect(settled).toBe(false);
      expect(navigation.successor).toBeUndefined();
      expect(navigation.outcome).toBeUndefined();
      expect(page.isClosed()).toBe(false);
      await barrier.release();
      const result = await outcome;
      expect(result.error).toBeInstanceOf(AggregateError);
      expect(errorsIn(result.error)).toEqual([bodyError]);
      expect(navigation.outcome?.error).toBeUndefined();
      expect(navigation.outcome?.response?.status()).toBe(200);
      expect(navigation.successor).toBeDefined();
      expect(successorAfterFinalization).toBe(true);
      expect(navigation.successor?.redirectedFrom()).toBe(navigation.root);
      expect(new URL(navigation.successor?.url() ?? "").pathname).toBe(
        destination,
      );
      expect(page.isClosed()).toBe(true);
      const producer = await finalization.result();
      const redirect = producer.requests.filter(
        (request) =>
          request.value.path === path && !("entrypoint" in request.value),
      );
      const target = producer.requests.filter(
        (request) =>
          request.value.path === destination &&
          !("entrypoint" in request.value),
      );
      expect(redirect).toHaveLength(1);
      expect(target).toHaveLength(1);
      expect(redirect[0]).toMatchObject({
        outcome: "fulfilled",
        value: {
          method: "GET",
          path,
          requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        },
        result: 303,
      });
      expect(target[0]).toMatchObject({
        outcome: "fulfilled",
        value: {
          method: "GET",
          path: destination,
          requestId: redirect[0].value.requestId,
        },
        result: 200,
      });
      expect(producer.backgroundErrors).toEqual([]);
      const attachment = testInfo.attachments.filter(
        (attachment) => attachment.name === "homework-effects",
      );
      expect(attachment).toHaveLength(1);
      const attachmentBody = attachment[0].body;
      if (!attachmentBody)
        throw new Error("Missing native homework-effects body");
      const effects = JSON.parse(attachmentBody.toString());
      const rootRead = effects.admittedReads.find(
        (read: { path: string }) => read.path === path,
      );
      const targetRead = effects.admittedReads.find(
        (read: { path: string }) => read.path === destination,
      );
      expect(rootRead).toBeDefined();
      expect(targetRead).toBeDefined();
      expect(targetRead.requestId).toBe(rootRead.requestId);
      expect(targetRead.order).toBeGreaterThan(rootRead.order);
      expect(effects.reads).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ order: rootRead.order, path, status: 303 }),
          expect.objectContaining({
            order: targetRead.order,
            path: destination,
            status: 200,
          }),
        ]),
      );
      expect(effects.navigationObservations).toContainEqual(
        expect.objectContaining({
          order: rootRead.order,
          outcome: "committed",
        }),
      );
      expect(
        await isolatedWorker.database.owner.comment.findUnique({
          where: { id: comment.id },
        }),
      ).toEqual(comment);
      await barrier.assertBackendDisconnected();
      await testInfo.attach("late-native-redirect-complete", {
        body: JSON.stringify({
          ...barrier.identity,
          blocked,
          redirect,
          target,
          successorAfterFinalization,
          pageClosed: page.isClosed(),
          controlSignal: {
            url: control.url,
            received: control.received,
            completed: control.completed,
            pending: control.pending,
          },
        }),
        contentType: "application/json",
      });
    } finally {
      // Release before joining the wrapper even when setup/assertions fail.
      // Product page closure precedes control-server teardown and handler joins.
      signal?.release();
      try {
        await barrier.release();
      } finally {
        try {
          await Promise.allSettled([
            ...(workflow ? [workflow] : []),
            ...browserOperations,
          ]);
        } finally {
          page.off("request", onRequest);
          finalization.restore();
          try {
            await barrier.close();
          } finally {
            await signal?.close();
          }
        }
      }
    }
  });
});
