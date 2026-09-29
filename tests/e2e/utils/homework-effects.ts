import { readFileSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import {
  expect,
  type Page,
  type Request,
  type TestInfo,
} from "@playwright/test";
import { parse } from "jsonc-parser";
import { ownBrowserReads } from "./browser-read-lifecycle";
import type { IsolatedWorker } from "./isolated-worker";

type CalendarMessage =
  | { type: "section"; sectionId: number }
  | { type: "user"; userId: string };
export type HomeworkEffects = {
  calendarTokenCreated?: boolean;
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
  duringRemoval: (
    requests: readonly Request[],
    action: () => Promise<void>,
  ) => Promise<void>;
};
type CalendarObservation = {
  attempts: {
    id: string;
    attempts: number;
    userId: string;
    sectionId?: number;
    ackCalls: number;
    retryCalls: number;
    complete: boolean;
    errors: string[];
    calendar: string | null;
  }[];
  calendar: string | null;
};
type ProducerObservation = {
  messages: { outcome: string; value: CalendarMessage }[];
  purges: { outcome: string }[];
  backgroundErrors: string[];
  requests: {
    outcome: string;
    value: {
      method: string;
      path: string;
      requestId?: string;
      entrypoint?: "PublicSsr";
    };
    result: number;
  }[];
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
    testInfo,
    calendarMessages,
    calendarTokenCreated = false,
    auditActions = {},
    observeReads = false,
  }: HomeworkEffects & {
    page: Page;
    isolatedWorker: IsolatedWorker;
    account: { id: string };
    sectionId?: number;
    testInfo: TestInfo;
    // Consumer scenarios must drain GET waitUntil work before asserting no effects.
    observeReads?: boolean;
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
  const writes: { method: string; path: string; status: number }[] = [];
  const retiredNativeStatuses = new Map<number, number>();
  const removedNativeStatuses = new Map<number, number>();
  let accepting = true;
  let registered = false;
  const browserReads = ownBrowserReads(
    page,
    isolatedWorker.origin,
    () => accepting,
  );
  const {
    ownedReads,
    reads,
    supersededCalendarReads,
    retiredReads,
    removedReads,
    pendingReads,
  } = browserReads;

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

  async function collect(expectedMessages = calendarMessages.length) {
    let snapshot:
      | { producer: ProducerObservation; consumer: CalendarObservation }
      | undefined;
    await expect
      .poll(
        async () => {
          const producerResponse = await request.get(producerPath, {
            headers: secret,
          });
          expect(producerResponse.status()).toBe(200);
          const producer: ProducerObservation = await producerResponse.json();
          const consumerResponse = await request.get(consumerPath, {
            headers: secret,
          });
          expect(consumerResponse.status()).toBe(200);
          const consumer: CalendarObservation = await consumerResponse.json();
          snapshot = { producer, consumer };
          return (
            producer.messages.length >= expectedMessages &&
            consumer.attempts.length >= expectedMessages &&
            consumer.attempts.every((attempt) => attempt.complete)
          );
        },
        {
          timeout: 15_000,
          message: "Native homework calendar consumers complete",
        },
      )
      .toBe(true);
    if (!snapshot) throw new Error("Missing homework effect observations");
    return snapshot;
  }

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
        const read = reads.find((read) => read.order === owned.order);
        if (workerAsset(owned.path)) {
          if (!read)
            throw new Error(
              `Static asset has no browser response: ${owned.path}`,
            );
          expect(read.status, `Static asset ${owned.path}`).toBe(200);
          continue;
        }
        const index = unmatched.findIndex(
          (request) =>
            !request.value.entrypoint &&
            request.value.requestId === owned.requestId &&
            request.value.method === owned.method &&
            request.value.path === owned.path &&
            (read === undefined || request.result === read.status),
        );
        expect(
          index,
          `Worker completed ${owned.method} ${owned.path}${read ? ` (${read.status})` : " (no browser response)"}`,
        ).toBeGreaterThanOrEqual(0);
        const [native] = unmatched.splice(index, 1);
        if (removedReads.some((removed) => removed.order === owned.order)) {
          expect(
            native.result,
            `Removed component ${owned.method} ${owned.path}`,
          ).toBe(200);
          removedNativeStatuses.set(owned.order, native.result);
        }
        if (
          !read &&
          ((!owned.settled && owned.retiredBy) ||
            retiredReads.some((retired) => retired.order === owned.order))
        ) {
          expect(
            native.result,
            `Retired consumer ${owned.method} ${owned.path}`,
          ).toBeGreaterThanOrEqual(200);
          expect(
            native.result,
            `Retired consumer ${owned.method} ${owned.path}`,
          ).toBeLessThan(400);
          retiredNativeStatuses.set(owned.order, native.result);
        }
      }
      for (const cancelled of supersededCalendarReads)
        expect(
          reads.some(
            (read) =>
              read.path === cancelled.path &&
              read.order > cancelled.order &&
              read.status === 200,
          ),
        ).toBe(true);
    }
  }

  async function observe(
    expected: HomeworkEffects = {
      calendarMessages,
      calendarTokenCreated,
      auditActions,
    },
  ) {
    const {
      calendarMessages,
      calendarTokenCreated = false,
      auditActions = {},
    } = expected;
    const { producer, consumer } = await collect(calendarMessages.length);
    assertServerReads(producer);
    expect(producer.backgroundErrors).toEqual([]);
    expect(
      producer.purges.every((purge) => purge.outcome === "fulfilled"),
    ).toBe(true);
    expect(
      producer.messages.map((message) => JSON.stringify(message)).sort(),
    ).toEqual(
      calendarMessages
        .map((value) => JSON.stringify({ outcome: "fulfilled", value }))
        .sort(),
    );
    expect(consumer.attempts).toHaveLength(calendarMessages.length);
    expect(new Set(consumer.attempts.map((attempt) => attempt.id)).size).toBe(
      calendarMessages.length,
    );
    expect(
      consumer.attempts
        .map((attempt) =>
          JSON.stringify(
            attempt.sectionId === undefined
              ? { type: "user", userId: attempt.userId }
              : { type: "section", sectionId: attempt.sectionId },
          ),
        )
        .sort(),
    ).toEqual(
      calendarMessages.map((message) => JSON.stringify(message)).sort(),
    );
    for (const attempt of consumer.attempts) {
      expect(attempt).toMatchObject({
        attempts: 1,
        userId: account.id,
        ackCalls: 1,
        retryCalls: 0,
        complete: true,
        errors: [],
        calendar: expect.any(String),
      });
      const calendar = JSON.parse(attempt.calendar as string);
      expect(calendar).toMatchObject({ version: 2, text: expect.any(String) });
      expect(calendar.text).toContain("BEGIN:VCALENDAR");
      expect(calendar.text).toContain("END:VCALENDAR");
    }
    if (calendarMessages.length)
      expect(
        consumer.attempts.some(
          (attempt) => attempt.calendar === consumer.calendar,
        ),
      ).toBe(true);

    const actor = await db.user.findUniqueOrThrow({
      where: { id: account.id },
    });
    const expectedActions: Record<string, number> = { ...auditActions };
    expect(actor.calendarFeedToken).toEqual(
      calendarTokenCreated ? expect.any(String) : null,
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
    return {
      calendarMessages,
      calendarTokenCreated,
      auditActions,
      producer,
      consumer,
      audits,
      writes,
      reads,
      supersededCalendarReads,
      removedReads: removedReads.map((read) => ({
        ...read,
        nativeStatus: removedNativeStatuses.get(read.order),
      })),
      retiredReads: retiredReads.map((read) => ({
        ...read,
        nativeStatus: retiredNativeStatuses.get(read.order),
      })),
      navigationCommits: browserReads.navigationCommits,
      navigationObservations: browserReads.navigationObservations,
      admittedReads: [...ownedReads.values()].map(
        ({ requestId, order, path, method, mainFrame, retiredBy }) => ({
          requestId,
          order,
          path,
          method,
          mainFrame,
          retiredBy,
        }),
      ),
    };
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

  const checkpoints: {
    name: string;
    expected: HomeworkEffects;
    status: "pending" | "passed" | "failed";
    observation?: Pick<
      Awaited<ReturnType<typeof observe>>,
      "producer" | "consumer" | "audits"
    >;
  }[] = [];

  async function checkpoint(name: string, expectation: HomeworkEffects) {
    if (!accepting || page.isClosed())
      throw new Error("Homework checkpoint requires an active workflow");
    const entry: (typeof checkpoints)[number] = {
      name,
      expected: structuredClone(expectation),
      status: "pending",
    };
    checkpoints.push(entry);
    try {
      await settleReads(entry.expected.calendarMessages.length);
      const { producer, consumer, audits } = await observe(entry.expected);
      entry.observation = { producer, consumer, audits };
      entry.status = "passed";
    } catch (error) {
      entry.status = "failed";
      // A callback catching the assertion cannot erase a failed checkpoint.
      errors.push(error);
      throw error;
    }
  }

  try {
    expect((await request.get(producerPath)).status()).toBe(404);
    expect((await request.get(consumerPath)).status()).toBe(404);
    expect(
      (await request.post(producerPath, { headers: secret })).status(),
    ).toBe(201);
    expect(
      (await request.post(consumerPath, { headers: secret })).status(),
    ).toBe(201);
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
            if (["POST", "PUT", "PATCH", "DELETE"].includes(incoming.method()))
              writes.push({
                method: incoming.method(),
                path: new URL(incoming.url()).pathname,
                status: response.status(),
              });
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
    await work({
      checkpoint,
      headers,
      readHeaders,
      activeReads: browserReads.activeReads,
      duringRemoval: browserReads.duringRemoval,
    });
  } catch (error) {
    errors.push(error);
  } finally {
    accepting = false;
    try {
      await settleReads(calendarMessages.length);
      if (observeReads && registered) {
        browserReads.prepareRetiredClose();
      }
    } catch (error) {
      errors.push(error);
    }
    if (!observeReads && registered)
      try {
        await testInfo.attach("homework-effects", {
          body: JSON.stringify({ ...(await observe()), checkpoints }, null, 2),
          contentType: "application/json",
        });
      } catch (error) {
        errors.push(error);
      }
    try {
      await page.close();
    } catch (error) {
      errors.push(error);
    }
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
    if (observeReads && registered)
      try {
        await testInfo.attach("homework-effects", {
          body: JSON.stringify({ ...(await observe()), checkpoints }, null, 2),
          contentType: "application/json",
        });
      } catch (error) {
        errors.push(error);
      }
    browserReads.stop();
    errors.push(...browserReads.errors);
  }
  if (errors.length)
    throw new AggregateError(errors, "Owned homework workflow failed");
}
