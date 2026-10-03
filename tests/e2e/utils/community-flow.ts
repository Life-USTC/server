import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  type APIRequestContext,
  type APIResponse,
  type Browser,
  type BrowserContext,
  expect,
  type Page,
  type Request,
  type Route,
} from "@playwright/test";
import { ownBrowserReads } from "./browser-read-lifecycle";
import { withBrowserWorkflow } from "./browser-workflow";
import type { ProducerObservation } from "./calendar-effects";
import { type HttpMcpRequest, ownHttpMcp } from "./http-mcp-lifecycle";
import type { IsolatedWorker } from "./isolated-worker";
import { withSettledPageWrites } from "./settled-page-writes";

type Expected = {
  calendarTokenCreated?: boolean;
  auditActions?: Record<string, number>;
  catalogPurges?: number;
  anonymousCourseCount?: number;
};
type RouteMatch = Parameters<Page["route"]>[0];
export type CommunityChecks = {
  verifyBrowserWrite?: (
    response: APIResponse,
    request: Request,
  ) => Promise<void>;
  verifyTransport: (observation: {
    producer: ProducerObservation;
    sdkRequests: HttpMcpRequest[];
  }) => Promise<void>;
  verifyState: () => Promise<void>;
};
export type CommunityFlow = {
  run: (
    work: () => Promise<void>,
    expected?: Expected,
    checks?: CommunityChecks,
  ) => Promise<void>;
  mcp: (
    identity: { name: string; version: string },
    accessToken: string,
  ) => Promise<Client>;
  assertAnonymousNoEffects: () => Promise<void>;
  newContext: (
    options?: Parameters<Browser["newContext"]>[0],
  ) => Promise<BrowserContext>;
  route: (
    page: Page,
    match: RouteMatch,
    handler: (route: Route) => Promise<void>,
  ) => Promise<void>;
  clearRoutes: (page: Page) => Promise<void>;
  closePage: (page: Page) => Promise<void>;
  closeContext: (context: BrowserContext) => Promise<void>;
  onClosing: (release: () => void) => void;
  expectReadCancellation: (page: Page, request: Request) => void;
};

/** Browser callbacks, deliberate response controls and real Worker effects have
 * separate owners. Controlled responses are retained as such, never reported as
 * successful real server requests. */
export async function withCommunityFlow(
  {
    page,
    browser,
    observer,
    isolatedWorker,
    account,
  }: {
    page: Page;
    browser: Browser;
    observer: APIRequestContext;
    isolatedWorker: IsolatedWorker;
    account: { id: string } | null;
  },
  use: (flow: CommunityFlow) => Promise<void>,
) {
  const db = isolatedWorker.database.owner;
  const origin = isolatedWorker.origin;
  const secret = { "x-test-storage-secret": "local-test-storage-observer" };
  const probeId = crypto.randomUUID();
  const probePath = "/__test/community-effects?id=" + probeId;
  const headers = { ...secret, "x-test-community-probe": probeId };
  const contexts: BrowserContext[] = [];
  const disabledScriptContexts = new Set<BrowserContext>();
  const reads = new Map<Page, ReturnType<typeof ownBrowserReads>>();
  const pending = new Set<Promise<void>>();
  const routes: {
    page: Page;
    match: RouteMatch;
    handler: (route: Route) => Promise<void>;
  }[] = [];
  const releases: (() => void)[] = [];
  const errors: unknown[] = [];
  let closing = false;
  let registrationAttempted = false;
  let registered = false;
  let operation: Promise<void> | undefined;
  let actualBody: Promise<void> | undefined;
  let completed = false;
  let expected: Expected = {};
  let checks: CommunityChecks | undefined;
  let observation: ProducerObservation | undefined;
  let finalization: Promise<void> | undefined;
  const remember = (error: unknown) => {
    if (!errors.includes(error)) errors.push(error);
  };
  const sdk = ownHttpMcp({ origin, headers, remember });
  const open = () => {
    if (closing) throw new Error("Community workflow is closing");
  };
  function observePage(current: Page) {
    if (reads.has(current)) return;
    const reader = ownBrowserReads(current, origin, () => !closing, {
      javaScriptEnabled: !disabledScriptContexts.has(current.context()),
    });
    reads.set(current, reader);
    reader.start();
  }
  async function clearRoutes(current: Page) {
    for (let i = routes.length - 1; i >= 0; i--) {
      const route = routes[i];
      if (route.page !== current) continue;
      await current.unroute(route.match, route.handler);
      routes.splice(i, 1);
    }
    while (pending.size) await Promise.allSettled([...pending]);
  }
  async function waitForActiveReads(current: Page) {
    const reader = reads.get(current);
    if (!reader || current.isClosed()) return;
    await expect
      .poll(
        () =>
          [...reader.ownedReads.values()].filter(
            (read) => !read.settled && !read.retiredBy,
          ).length,
        {
          timeout: 15_000,
          message: "Community active reads reach their browser terminal",
        },
      )
      .toBe(0);
  }
  async function preparePageClose(current: Page) {
    const reader = reads.get(current);
    if (!reader || current.isClosed()) return;
    await waitForActiveReads(current);
    reader.prepareRetiredClose();
  }
  async function closePage(current: Page) {
    const results = await Promise.allSettled([preparePageClose(current)]);
    results.push(...(await Promise.allSettled([current.close()])));
    const failures = results.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    );
    if (failures.length)
      throw new AggregateError(
        failures,
        "Community page read and close failed",
      );
  }
  async function closeContext(context: BrowserContext) {
    const results = await Promise.allSettled(context.pages().map(closePage));
    results.push(...(await Promise.allSettled([context.close()])));
    const failures = results.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    );
    if (failures.length)
      throw new AggregateError(
        failures,
        "Community context reads did not settle",
      );
  }
  async function stopAdmission() {
    closing = true;
    for (const release of releases.splice(0)) {
      try {
        release();
      } catch (error) {
        remember(error);
      }
    }
    for (const current of reads.keys()) {
      if (current.isClosed()) continue;
      await current.route(
        (url) => url.origin === origin,
        async (route) => {
          if (route.request().redirectedFrom()) await route.fallback();
          else await route.abort("aborted");
        },
      );
    }
    while (pending.size) await Promise.allSettled([...pending]);
    for (const current of reads.keys()) {
      if (current.isClosed()) continue;
      try {
        await preparePageClose(current);
      } catch (error) {
        remember(error);
      }
      if (current !== page) {
        try {
          await current.close();
        } catch (error) {
          remember(error);
        }
      }
    }
  }
  async function observeWrite(response: APIResponse, incoming: Request) {
    if (!account) throw new Error("Anonymous browser flow submitted a write");
    if (checks?.verifyBrowserWrite) {
      await checks.verifyBrowserWrite(response, incoming);
      return;
    }
    const path = new URL(incoming.url()).pathname;
    const body = await response.json();
    if (path === "/api/community/comments") {
      expect(incoming.method()).toBe("POST");
      expect(response.status()).toBe(201);
      const input = incoming.postDataJSON();
      expect(
        await db.comment.findUnique({ where: { id: body.id } }),
      ).toMatchObject({
        userId: account.id,
        body: input.body,
        status: "active",
      });
    } else if (/^\/api\/community\/comments\/[^/]+$/.test(path)) {
      const id = decodeURIComponent(
        path.slice("/api/community/comments/".length),
      );
      expect(response.status()).toBe(200);
      expect(body.success).toBe(true);
      const comment = await db.comment.findUnique({ where: { id } });
      if (incoming.method() === "DELETE") {
        expect(comment).toMatchObject({
          id,
          userId: account.id,
          status: "deleted",
          deletedAt: expect.any(Date),
        });
      } else {
        expect(incoming.method()).toBe("PATCH");
        const input = incoming.postDataJSON();
        expect(typeof input.body).toBe("string");
        expect(body.comment).toMatchObject({ id, body: input.body });
        expect(comment).toMatchObject({
          id,
          userId: account.id,
          body: input.body,
          status: "active",
        });
      }
    } else if (path === "/api/community/descriptions") {
      expect(incoming.method()).toBe("POST");
      expect(response.status()).toBe(200);
      const input = incoming.postDataJSON();
      expect(
        await db.description.findUnique({ where: { id: body.id } }),
      ).toMatchObject({
        content: input.content,
        lastEditedById: account.id,
      });
    } else throw new Error("Unexpected community browser write: " + path);
  }
  async function readProducer() {
    const response = await observer.get(probePath, { headers: secret });
    expect(response.status()).toBe(200);
    const producer = await response.json();
    return producer;
  }
  function assertProducer(producer: Awaited<ReturnType<typeof readProducer>>) {
    expect(producer.backgroundErrors).toEqual([]);
    expect(producer.messages).toEqual([]);
    expect(producer.requests.length).toBeGreaterThan(0);
    for (const request of producer.requests) {
      expect(request.outcome).toBe("fulfilled");
      expect(request.result).toEqual(expect.any(Number));
      if (["GET", "HEAD"].includes(request.value.method))
        expect(
          request.result,
          `Worker read ${request.value.method} ${request.value.path}`,
        ).toBeLessThan(500);
      if (!account) expect(["GET", "HEAD"]).toContain(request.value.method);
    }
    for (const purge of producer.purges) {
      expect(purge.outcome).toBe("fulfilled");
      expect(purge.result).toMatchObject({ ok: true });
    }
  }
  async function readAnonymousState() {
    return {
      users: await db.user.count(),
      comments: await db.comment.count(),
      homeworks: await db.homework.count(),
      todos: await db.todo.count(),
      subscriptions: await db.userSectionSubscription.count(),
      courses: await db.course.count(),
    };
  }
  function assertAnonymousState(state: Record<string, number>) {
    expect(state).toEqual({
      users: 0,
      comments: 0,
      homeworks: 0,
      todos: 0,
      subscriptions: 0,
      // Private catalog consumers declare the exact known course fixture size.
      // All other anonymous state remains empty; never infer an expectation
      // from the database being observed.
      courses: expected.anonymousCourseCount ?? 0,
    });
  }
  function assertAnonymousExpectations() {
    expect(expected).toEqual(
      expected.anonymousCourseCount === undefined
        ? {}
        : { anonymousCourseCount: expected.anonymousCourseCount },
    );
  }
  async function assertAnonymousNoEffects() {
    try {
      open();
      if (account || !registered || !actualBody || completed)
        throw new Error(
          "Anonymous effect checks require an active owned public flow",
        );
      // Keep the page and admission open. Retired-document reads remain owned by
      // the finalizer; only the current document must reach its browser terminal.
      while (pending.size) await Promise.allSettled([...pending]);
      for (const current of reads.keys()) await waitForActiveReads(current);
      open();
      // GET drains this probe's actual requests and their appended background work
      // without clearing cumulative observations or closing its Worker.
      const producer = await readProducer();
      const audits = await db.auditLog.findMany();
      const state = await readAnonymousState();
      assertProducer(producer);
      assertAnonymousExpectations();
      expect(producer.purges).toEqual([]);
      expect(audits).toEqual([]);
      expect(errors).toEqual([]);
      for (const reader of reads.values()) expect(reader.errors).toEqual([]);
      assertAnonymousState(state);
    } catch (error) {
      remember(error);
      throw error;
    }
  }
  function finalize() {
    finalization ??= (async () => {
      closing = true;
      // Close secondary contexts before joining the callback: an interrupted
      // newPage() call may need context closure to settle.
      for (const context of contexts) {
        try {
          await context.close();
        } catch (error) {
          remember(error);
        }
      }
      // Release an interrupted SDK call before joining the actual callback.
      await sdk.close(completed);
      // Keep the database alive for the callback's remaining observations.
      if (actualBody) {
        try {
          await actualBody;
        } catch (error) {
          remember(error);
        }
      }
      await sdk.settle();
      while (pending.size) await Promise.allSettled([...pending]);
      for (const reader of reads.values()) {
        while (reader.pendingReads.size || reader.pendingNavigations.size)
          await Promise.allSettled([
            ...reader.pendingReads,
            ...reader.pendingNavigations,
          ]);
        reader.stop();
        errors.push(...reader.errors);
      }
      if (registered) {
        try {
          const producer = await readProducer();
          observation = producer;
          assertProducer(producer);
          for (const request of sdk.requests) {
            expect(
              producer.requests.filter(
                (native: ProducerObservation["requests"][number]) =>
                  native.value.requestId === request.requestId,
              ),
            ).toEqual([
              {
                outcome: "fulfilled",
                value: {
                  requestId: request.requestId,
                  method: request.method,
                  path: request.path,
                },
                result: request.status,
              },
            ]);
          }
          const readAudits = () =>
            db.auditLog.findMany({
              where: account ? { userId: account.id } : undefined,
            });
          let audits = await readAudits();
          if (completed) {
            expect(producer.purges).toHaveLength(expected.catalogPurges ?? 0);
            const wanted: Record<string, number> = { ...expected.auditActions };
            if (expected.calendarTokenCreated)
              wanted.account_calendar_token_create = 1;
            // The request drain waits for enqueue; the queue consumer persists
            // audits separately. Observe that real result before asserting it.
            await expect
              .poll(
                async () => {
                  audits = await readAudits();
                  const actions: Record<string, number> = {};
                  for (const audit of audits)
                    actions[audit.action] = (actions[audit.action] ?? 0) + 1;
                  return actions;
                },
                {
                  timeout: 15_000,
                  message: "Actual community and calendar token audits persist",
                },
              )
              .toEqual(wanted);
            const actual: Record<string, number> = {};
            for (const audit of audits) {
              expect(audit.outcome).toBe("success");
              actual[audit.action] = (actual[audit.action] ?? 0) + 1;
            }
            expect(actual).toEqual(wanted);
            if (account) {
              expect(expected.anonymousCourseCount).toBeUndefined();
              const user = await db.user.findUniqueOrThrow({
                where: { id: account.id },
              });
              expect(user.calendarFeedToken).toEqual(
                expected.calendarTokenCreated ? expect.any(String) : null,
              );
            } else {
              // Anonymous checks own an empty graph except an explicitly
              // declared course fixture; no synthetic account is needed.
              assertAnonymousExpectations();
              const anonymousState = await readAnonymousState();
              assertAnonymousState(anonymousState);
            }
          }
        } catch (error) {
          remember(error);
        }
      }
      if (registrationAttempted) {
        try {
          const response = await observer.delete(probePath, {
            headers: secret,
          });
          await response.body();
          if (registered) expect(response.status()).toBe(204);
          else expect([204, 404]).toContain(response.status());
        } catch (error) {
          remember(error);
        }
      }
      if (completed && checks) {
        if (observation) {
          try {
            await checks.verifyTransport({
              producer: observation,
              sdkRequests: sdk.requests,
            });
          } catch (error) {
            remember(error);
          }
        }
        // Independent state checks run even when transport/evidence failed.
        try {
          await checks.verifyState();
        } catch (error) {
          remember(error);
        }
      }
      if (errors.length)
        throw new AggregateError(
          errors,
          "Community browser workflow and effects failed",
        );
    })();
    return finalization;
  }
  observePage(page);
  const onPage = (current: Page) => {
    if (!closing) {
      observePage(current);
      return;
    }
    const settled = current.close().catch(remember);
    pending.add(settled);
    void settled.finally(() => pending.delete(settled));
  };
  page.context().on("page", onPage);
  try {
    // Establish native fixture use before run can register its effect probe.
    await withBrowserWorkflow(page, async (workflow) => {
      try {
        await use({
          assertAnonymousNoEffects,
          async mcp(identity, accessToken) {
            open();
            if (!actualBody || completed)
              throw new Error(
                "Community MCP requires an active workflow callback",
              );
            return sdk.connect(identity, accessToken);
          },
          onClosing(release) {
            open();
            releases.push(release);
          },
          expectReadCancellation(current, request) {
            open();
            const reader = reads.get(current);
            if (!reader)
              throw new Error(
                "Cancellation page is not owned by this workflow",
              );
            reader.expectCancellation(request);
          },
          clearRoutes,
          closePage,
          closeContext,
          async route(current, match, handler) {
            open();
            const owned = async (route: Route) => {
              const task = Promise.resolve()
                .then(async () => {
                  open();
                  await handler(route);
                })
                .catch(async (error) => {
                  remember(error);
                  try {
                    await route.abort("aborted");
                  } catch (abortError) {
                    remember(abortError);
                  }
                });
              pending.add(task);
              try {
                await task;
              } finally {
                pending.delete(task);
              }
            };
            routes.push({ page: current, match, handler: owned });
            await current.route(match, owned);
            if (closing) {
              await current.unroute(match, owned);
              open();
            }
          },
          newContext(options = {}) {
            open();
            if (!actualBody || completed)
              throw new Error(
                "Community contexts require an active workflow callback",
              );
            const creation = Promise.resolve().then(async () => {
              open();
              const context = await browser.newContext({
                ...options,
                baseURL: origin,
                extraHTTPHeaders: { ...options.extraHTTPHeaders, ...headers },
              });
              contexts.push(context);
              if (closing) {
                await context.close();
                open();
              }
              if (options.javaScriptEnabled === false)
                disabledScriptContexts.add(context);
              context.on("page", onPage);
              return context;
            });
            // Own acquisition before yielding; a late context is closed above
            // when interruption has already ended callback admission.
            const settled = creation.then(
              () => undefined,
              (error) => {
                remember(error);
              },
            );
            pending.add(settled);
            void settled.finally(() => pending.delete(settled));
            return creation;
          },
          run(work, wanted = {}, verification) {
            if (operation || closing)
              return Promise.reject(
                new Error("Community workflow already owned or closing"),
              );
            expected = wanted;
            checks = verification;
            operation = workflow.run(async () => {
              try {
                // This operation is already owned before registration can begin.
                open();
                registrationAttempted = true;
                const registration = await observer.post(probePath, {
                  headers: secret,
                });
                registered = registration.status() === 201;
                expect(registration.status()).toBe(201);
                await registration.body();
                open();
                await page.context().setExtraHTTPHeaders(headers);
                open();
                await withSettledPageWrites(
                  page,
                  (url) => url.origin === origin,
                  async () => {
                    try {
                      await workflow.body(() => {
                        actualBody = Promise.resolve().then(async () => {
                          await work();
                          completed = true;
                        });
                        return actualBody;
                      });
                    } finally {
                      await stopAdmission();
                    }
                  },
                  observeWrite,
                );
              } catch (error) {
                remember(error);
              }
              // Preparation can fail before the write wrapper owns page closure.
              // Keep its failure path in the same close → callback → effects order.
              if (!page.isClosed()) {
                try {
                  await stopAdmission();
                } catch (error) {
                  remember(error);
                }
                try {
                  await page.close();
                } catch (error) {
                  remember(error);
                }
              }
              await finalize();
            });
            return operation;
          },
        });
      } finally {
        closing = true;
        for (const release of releases.splice(0)) {
          try {
            release();
          } catch (error) {
            remember(error);
          }
        }
      }
    });
  } catch (error) {
    remember(error);
  } finally {
    closing = true;
    page.context().off("page", onPage);
    for (const context of contexts) context.off("page", onPage);
    if (!operation) {
      try {
        await stopAdmission();
      } catch (error) {
        remember(error);
      }
      try {
        await page.close();
      } catch (error) {
        remember(error);
      }
    }
    try {
      await operation;
    } catch (error) {
      remember(error);
    }
    try {
      await finalize();
    } catch (error) {
      remember(error);
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length)
    throw new AggregateError(
      errors,
      "Community workflow and finalization failed",
    );
}
