import { readFileSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { expect, type Page, type Request, test } from "@playwright/test";
import { parse } from "jsonc-parser";
import { ownBrowserReads } from "./browser-read-lifecycle";
import {
  type CalendarMessage,
  createCalendarEffectObserver,
  type ProducerObservation,
} from "./calendar-effects";
import type { IsolatedWorker } from "./isolated-worker";

export type HomeworkEffects = {
  calendarTokenCreated?: boolean;
  presetCalendarToken?: string;
  calendarMessages: CalendarMessage[];
  auditActions?: Partial<
    Record<
      | "homework_create"
      | "homework_update"
      | "homework_delete"
      | "comment_create"
      | "description_edit",
      number
    >
  >;
};
export type HomeworkEffectContext = {
  checkpoint: (name: string, expected: HomeworkEffects) => Promise<void>;
  headers: Record<string, string>;
  readHeaders: (incoming: Request) => Record<string, string>;
  activeReads: () => Request[];
  expectReadCancellation: (page: Page, request: Request) => void;
  onClosing: (release: () => void) => void;
  duringRemoval: (
    requests: readonly Request[],
    action: () => Promise<void>,
  ) => Promise<void>;
};

/** Only existing files on the configured assets-first routes bypass the Worker. */
function configuredWorkerAssets() {
  const config = parse(readFileSync(resolve("wrangler.e2e.jsonc"), "utf8"));
  const routes: string[] = config.assets.run_worker_first;
  if (
    routes[0] !== "/*" ||
    routes.slice(1).some((route) => !/^!\/[^*]*(?:\*)?$/.test(route))
  )
    throw new Error("Unsupported private Worker asset routing");
  const directory = resolve(config.assets.directory);
  return (path: string) => {
    const excluded = routes.slice(1).some((route) => {
      const pattern = route.slice(1);
      return pattern.endsWith("*")
        ? path.startsWith(pattern.slice(0, -1))
        : path === pattern;
    });
    if (!excluded) return false;
    const filename = resolve(directory, `.${decodeURIComponent(path)}`);
    if (!filename.startsWith(`${directory}${sep}`)) return false;
    return statSync(filename, { throwIfNoEntry: false })?.isFile() ?? false;
  };
}

/** Explicit scenario expectations; observers never derive them from the producer. */
export async function withHomeworkEffects(
  {
    page,
    isolatedWorker,
    account,
    sectionId,
    calendarMessages,
    calendarTokenCreated = false,
    presetCalendarToken,
    auditActions = {},
    observeReads = false,
    runBody = (body) => body(),
  }: HomeworkEffects & {
    page: Page;
    isolatedWorker: IsolatedWorker;
    account: { id: string };
    sectionId?: number;
    // Consumer scenarios must drain GET waitUntil work before asserting no effects.
    observeReads?: boolean;
    // The wrapper may interrupt its wait; this helper still owns the real body.
    runBody?: (body: () => Promise<void>) => Promise<void>;
  },
  work: (effects: HomeworkEffectContext) => Promise<void>,
) {
  const request = page.request;
  const workerAsset = observeReads ? configuredWorkerAssets() : () => false;
  const db = isolatedWorker.database.owner;
  const secret = { "x-test-storage-secret": "local-test-storage-observer" };
  const id = crypto.randomUUID();
  const headers = { ...secret, "x-test-community-probe": id };
  const producerPath = `/__test/community-effects?id=${id}`;
  const consumerPath = `/__test/calendar-consumer?userId=${account.id}${sectionId === undefined ? "" : `&sectionId=${sectionId}`}`;
  const pending = new Set<Promise<void>>();
  const errors: unknown[] = [];
  const closingReleases: (() => void)[] = [];
  let actualBody:
    | Promise<{ ok: true } | { ok: false; error: unknown }>
    | undefined;
  let accepting = true;
  let registered = false;
  const browserReads = ownBrowserReads(
    page,
    isolatedWorker.origin,
    () => accepting,
  );
  const { ownedReads, pendingReads } = browserReads;

  function readHeaders(incoming: Request) {
    const requestId = ownedReads.get(incoming)?.requestId;
    if (!requestId)
      throw new Error("Calendar read is not owned by this workflow");
    return {
      ...incoming.headers(),
      ...headers,
      "x-test-community-request": requestId,
    };
  }

  const calendarEffects = createCalendarEffectObserver({
    request,
    producerPath,
    account,
    sectionId,
  });
  const collect = calendarEffects.collect;

  function assertServerReads(producer: ProducerObservation) {
    if (observeReads) {
      expect(producer.requests.length).toBeGreaterThan(0);
      for (const request of producer.requests) {
        expect(request.outcome).toBe("fulfilled");
        expect(request.result).toEqual(expect.any(Number));
      }
      // The server independently records tagged requests, including redirect
      // successors and handlers that outlive a cancelled browser request.
      const unmatched = [...producer.requests];
      for (const owned of ownedReads.values()) {
        const status = owned.status;
        if (workerAsset(owned.path)) {
          if (owned.canceled) continue;
          // Replaced documents can retain response() until page.close(). Defer
          // only these pending reads; the final joined observation still checks
          // their native cancellation or response status.
          if (!owned.settled && owned.retiredBy) continue;
          if (status === undefined)
            throw new Error(
              `Static asset has no browser response: ${owned.path}`,
            );
          expect(status, `Static asset ${owned.path}`).toBe(200);
          continue;
        }
        const index = unmatched.findIndex(
          (request) =>
            !request.value.entrypoint &&
            request.value.requestId === owned.requestId &&
            request.value.method === owned.method &&
            request.value.path === owned.path &&
            (status === undefined || request.result === status),
        );
        // Native cancellation may happen before dispatch or while the Worker
        // finishes an obsolete read. collect() still drains every dispatched
        // request; cancellation never manufactures a successful browser result.
        if (owned.canceled && index === -1) continue;
        expect(
          index,
          `Worker completed ${owned.method} ${owned.path}${status === undefined ? " (no browser response)" : ` (${status})`}`,
        ).toBeGreaterThanOrEqual(0);
        const [native] = unmatched.splice(index, 1);
        if (owned.canceled)
          expect(
            native.result,
            `Canceled Worker read ${owned.method} ${owned.path}`,
          ).toBeLessThan(500);
        // A public cache miss renders through a second Worker entrypoint. It
        // belongs to this exact outer request, not a second browser request.
        const publicSsr = unmatched.filter(
          (request) =>
            request.value.entrypoint === "PublicSsr" &&
            request.value.requestId === native.value.requestId &&
            request.value.method === native.value.method &&
            request.value.path === native.value.path,
        );
        expect(
          publicSsr.length,
          `At most one PublicSsr render for ${owned.method} ${owned.path}`,
        ).toBeLessThanOrEqual(1);
        const [render] = publicSsr;
        if (render) {
          expect(render.outcome).toBe("fulfilled");
          expect(
            render.result,
            `PublicSsr preserved ${owned.method} ${owned.path} status`,
          ).toBe(native.result);
          unmatched.splice(unmatched.indexOf(render), 1);
        }
      }
      if ([...ownedReads.values()].some((read) => read.canceled))
        expect(
          unmatched.filter((request) => request.value.requestId),
          "Every tagged Worker request belongs to an observed browser request",
        ).toEqual([]);
    }
  }

  async function observe(
    expected: HomeworkEffects = {
      calendarMessages,
      calendarTokenCreated,
      presetCalendarToken,
      auditActions,
    },
    completed = true,
  ) {
    const {
      calendarMessages,
      calendarTokenCreated = false,
      presetCalendarToken,
      auditActions = {},
    } = expected;
    if (calendarTokenCreated && presetCalendarToken !== undefined)
      throw new Error("A preset calendar token cannot also be newly created");
    const observation = await collect(
      completed ? calendarMessages.length : "submitted",
    );
    const { producer } = observation;
    assertServerReads(producer);
    calendarEffects.assert(observation, calendarMessages, completed);
    const actor = await db.user.findUniqueOrThrow({
      where: { id: account.id },
    });
    const expectedActions: Record<string, number> = { ...auditActions };
    expect(actor.calendarFeedToken).toEqual(
      calendarTokenCreated ? expect.any(String) : (presetCalendarToken ?? null),
    );
    if (calendarTokenCreated) expectedActions.account_calendar_token_create = 1;
    const readAudits = () =>
      db.auditLog.findMany({
        where: { userId: account.id },
        select: {
          action: true,
          channel: true,
          outcome: true,
          targetId: true,
          targetType: true,
          userId: true,
          subjectUserId: true,
        },
      });
    const expectedCount = Object.values(expectedActions).reduce(
      (sum, count) => sum + count,
      0,
    );
    await expect
      .poll(async () => (await readAudits()).length, {
        timeout: 15_000,
        message: "Actual homework and calendar token audits persist",
      })
      .toBe(expectedCount);
    const audits = await readAudits();
    const actualActions: Record<string, number> = {};
    for (const audit of audits) {
      actualActions[audit.action] = (actualActions[audit.action] ?? 0) + 1;
      expect(audit).toMatchObject({
        outcome: "success",
        userId: account.id,
        targetId: expect.any(String),
      });
      if (audit.action === "account_calendar_token_create")
        expect(audit).toEqual({
          action: "account_calendar_token_create",
          channel: "system",
          outcome: "success",
          targetId: account.id,
          targetType: "calendar_feed",
          userId: account.id,
          subjectUserId: account.id,
        });
    }
    expect(actualActions).toEqual(expectedActions);
  }

  async function settleReads(expectedMessages: number) {
    // Route continuations/writes settle independently of response() promises
    // that Chromium can strand when their originating document is replaced.
    while (pending.size) await Promise.allSettled(pending);
    if (observeReads && registered) {
      await expect
        .poll(
          () =>
            [...ownedReads.values()].filter(
              (owned) => !owned.settled && !owned.retiredBy,
            ).length,
          {
            timeout: 15_000,
            message: "Current document reads receive a native browser terminal",
          },
        )
        .toBe(0);
      // A retired browser request may reach its native handler after navigation.
      // Retry only this read-only observation; missing completion still fails.
      await expect(async () => {
        assertServerReads((await collect(expectedMessages)).producer);
      }).toPass({ timeout: 15_000 });
    }
  }

  async function checkpoint(name: string, expectation: HomeworkEffects) {
    if (!accepting || page.isClosed())
      throw new Error("Homework checkpoint requires an active workflow");
    try {
      await test.step(name, async () => {
        await settleReads(expectation.calendarMessages.length);
        await observe(expectation);
      });
    } catch (error) {
      // A callback catching the assertion cannot erase a failed checkpoint.
      errors.push(error);
      throw error;
    }
  }

  try {
    if (calendarTokenCreated && presetCalendarToken !== undefined)
      throw new Error("A preset calendar token cannot also be newly created");
    expect((await request.get(producerPath)).status()).toBe(404);
    expect((await request.get(consumerPath)).status()).toBe(404);
    expect(
      (await request.post(producerPath, { headers: secret })).status(),
    ).toBe(201);
    await calendarEffects.register();
    registered = true;
    if (observeReads) browserReads.start();
    await page.route(
      (url) => url.origin === isolatedWorker.origin,
      async (route) => {
        if (
          !["POST", "PUT", "PATCH", "DELETE"].includes(route.request().method())
        ) {
          if (!observeReads) return route.continue();
          if (!ownedReads.has(route.request())) return route.abort("aborted");
          // Native continuation preserves the browser's redirects and carries
          // the probe headers to every request in that chain.
          const continuation = route.continue({
            headers: readHeaders(route.request()),
          });
          pending.add(continuation);
          try {
            await continuation;
          } catch (error) {
            errors.push(error);
          } finally {
            pending.delete(continuation);
          }
          return;
        }
        let fulfilled = false;
        const operation = (async () => {
          try {
            if (!accepting)
              throw new Error("Homework request started during teardown");
            const incoming = route.request();
            const response = await route.fetch({
              maxRedirects: 0,
              headers: { ...incoming.headers(), ...headers },
            });
            await response.body();
            // Deliver the genuine response before joining native asynchronous effects.
            await route.fulfill({ response });
            fulfilled = true;
          } catch (error) {
            errors.push(error);
            if (!fulfilled)
              try {
                await route.abort("aborted");
              } catch (abortError) {
                errors.push(abortError);
              }
          }
        })();
        pending.add(operation);
        try {
          await operation;
        } finally {
          pending.delete(operation);
        }
      },
    );
    await page.route(
      (url) =>
        url.href === "https://www.googletagmanager.com/gtag/js?id=G-JNK35J2Q3R",
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/javascript",
          body: "",
        }),
    );
    await runBody(() => {
      const body = Promise.resolve().then(() =>
        work({
          checkpoint,
          headers,
          readHeaders,
          activeReads: browserReads.activeReads,
          expectReadCancellation(current, request) {
            if (!accepting || !observeReads || current !== page)
              throw new Error(
                "Cancellation requires this active workflow page",
              );
            browserReads.expectCancellation(request);
          },
          onClosing(release) {
            if (!accepting)
              throw new Error("Closing callback requires an active workflow");
            closingReleases.push(release);
          },
          duringRemoval: browserReads.duringRemoval,
        }),
      );
      actualBody = body.then(
        () => ({ ok: true as const }),
        (error: unknown) => ({ ok: false as const, error }),
      );
      return body;
    });
  } catch (error) {
    errors.push(error);
  } finally {
    accepting = false;
    for (const release of closingReleases.splice(0)) {
      try {
        release();
      } catch (error) {
        errors.push(error);
      }
    }
    try {
      // Preserve native read/redirect completion while the page is open. Full
      // business expectations may depend on a callback released by page.close.
      await settleReads(0);
      if (observeReads && registered) {
        browserReads.prepareRetiredClose();
      }
    } catch (error) {
      errors.push(error);
    }
    try {
      await page.close();
    } catch (error) {
      errors.push(error);
    }
    // workflow.body() can reject on interruption before its callback finishes.
    // Join the real callback, including cookie preparation and finally work,
    // before the final producer/consumer/token/audit snapshot in either mode.
    const bodyResult = await actualBody;
    if (bodyResult && !bodyResult.ok && !errors.includes(bodyResult.error))
      errors.push(bodyResult.error);
    // Context-owned page.request remains available after the page is closed.
    // Closing joins only proven retired reads; other rejections remain errors.
    // Redirect successors admitted during finalization can add route operations.
    while (
      pending.size ||
      pendingReads.size ||
      browserReads.pendingNavigations.size
    )
      await Promise.allSettled([
        ...pending,
        ...pendingReads,
        ...browserReads.pendingNavigations,
      ]);
    if (registered)
      try {
        await observe(undefined, bodyResult?.ok !== false);
      } catch (error) {
        errors.push(error);
      }
    browserReads.stop();
    errors.push(...browserReads.errors);
  }
  if (errors.length)
    throw new AggregateError(errors, "Owned homework workflow failed");
}
