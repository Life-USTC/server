import {
  type APIRequestContext,
  type APIResponse,
  type Browser,
  type BrowserContext,
  expect,
  type Page,
  type Request,
  type Response,
  type Route,
} from "@playwright/test";
import { ownBrowserReads } from "./browser-read-lifecycle";
import { withBrowserWorkflow } from "./browser-workflow";
import type { IsolatedWorker } from "./isolated-worker";

type Mode = "consume" | "pins" | "bus" | "visits";
type RouteTarget = Page | BrowserContext;
type RouteMatch = Parameters<Page["route"]>[0];
export type PreferenceFlow = {
  headers: Record<string, string>;
  prepare: <T>(work: () => Promise<T>) => Promise<T>;
  http: (work: () => Promise<APIResponse>) => Promise<APIResponse>;
  run: (work: () => Promise<void>, mode?: Mode) => Promise<void>;
  newContext: (
    options?: Parameters<Browser["newContext"]>[0],
  ) => Promise<BrowserContext>;
  newPage: (context: BrowserContext) => Promise<Page>;
  waitForRequest: (
    context: BrowserContext,
    predicate: (request: Request) => boolean,
  ) => Promise<Request>;
  waitForPopup: (page: Page) => Promise<Page>;
  waitForResponse: (
    page: Page,
    predicate: (response: Response) => boolean,
  ) => Promise<Response>;
  closeContext: (context: BrowserContext) => Promise<void>;
  route: (
    target: RouteTarget,
    match: RouteMatch,
    handler: (route: Route) => Promise<void>,
  ) => Promise<void>;
  clearRoutes: (target: RouteTarget) => Promise<void>;
  onClosing: (release: () => void) => void;
  expectReadCancellation: (page: Page, request: Request) => void;
};

/** Own preference scenarios through native browser, HTTP and Worker completion.
 * Scenario assertions specify results; this owner verifies transport completion
 * and that consumers do not change independently arranged preference state. */
export async function withPreferenceFlow(
  {
    page,
    browser,
    observer,
    isolatedWorker,
  }: {
    page: Page;
    browser: Browser;
    observer: APIRequestContext;
    isolatedWorker: IsolatedWorker;
  },
  use: (flow: PreferenceFlow) => Promise<void>,
) {
  const origin = isolatedWorker.origin;
  const db = isolatedWorker.database.owner;
  const secret = { "x-test-storage-secret": "local-test-storage-observer" };
  // Probe calls span browser work; do not retain a socket across the Worker's
  // idle-connection timeout. Keep this header off browser requests.
  const probeOptions = { headers: { ...secret, Connection: "close" } };
  const probeId = crypto.randomUUID();
  const probePath = "/__test/community-effects?id=" + probeId;
  const headers = { ...secret, "x-test-community-probe": probeId };
  const contexts = new Set<BrowserContext>([page.context()]);
  const noScript = new Set<BrowserContext>();
  const readers = new Map<Page, ReturnType<typeof ownBrowserReads>>();
  const pending = new Set<Promise<void>>();
  // Playwright passes the same native Request through page/context fallback.
  // Preserve admission across a controlled request's handoff to the real proxy.
  const admittedRequests = new WeakSet<Request>();
  // Native page acquisition/event waits need context closure to interrupt;
  // submitted HTTP requests and browser writes must settle before that close.
  const browserOperations = new Map<BrowserContext, Set<Promise<void>>>();
  const releases: (() => void)[] = [];
  const controls: {
    target: RouteTarget;
    match: RouteMatch;
    handler: (route: Route) => Promise<void>;
  }[] = [];
  const errors: unknown[] = [];
  let closing = false;
  let registered = false;
  let actualBody: Promise<void> | undefined;
  let finalization: Promise<void> | undefined;
  let completed = false;
  let mode: Mode = "consume";
  let before: Awaited<ReturnType<typeof state>> | undefined;
  const contains = (parent: unknown, child: unknown): boolean =>
    parent === child ||
    (parent instanceof AggregateError &&
      parent.errors.some((entry) => contains(entry, child)));
  const remember = (error: unknown) => {
    if (error instanceof AggregateError) {
      for (const child of error.errors) remember(child);
    } else if (!errors.some((entry) => contains(entry, error)))
      errors.push(error);
  };
  const open = () => {
    if (closing) throw new Error("Preference workflow is closing");
  };
  function own<T>(work: () => Promise<T>) {
    const operation = Promise.resolve().then(work);
    const settled = operation.then(() => undefined, remember);
    pending.add(settled);
    void settled.finally(() => pending.delete(settled));
    return operation;
  }
  function ownBrowserOperation<T>(
    context: BrowserContext,
    work: () => Promise<T>,
  ) {
    open();
    if (!contexts.has(context))
      throw new Error(
        "Browser context is not owned by this preference workflow",
      );
    let operations = browserOperations.get(context);
    if (!operations) {
      operations = new Set();
      browserOperations.set(context, operations);
    }
    const operation = Promise.resolve().then(work);
    const settled = operation.then(() => undefined, remember);
    const owned = operations;
    owned.add(settled);
    void settled.finally(() => owned.delete(settled));
    return operation;
  }
  async function settle() {
    while (pending.size) await Promise.all([...pending]);
  }
  async function state() {
    return {
      pins: await db.workspaceLinkPin.findMany({
        orderBy: [{ userId: "asc" }, { slug: "asc" }],
      }),
      bus: await db.busUserPreference.findMany({ orderBy: { userId: "asc" } }),
      visits: await db.catalogLinkClick.findMany({
        orderBy: [{ userId: "asc" }, { slug: "asc" }],
      }),
    };
  }
  const observePage = (current: Page) => {
    if (readers.has(current)) return;
    const reader = ownBrowserReads(current, origin, () => !closing, {
      javaScriptEnabled: !noScript.has(current.context()),
    });
    readers.set(current, reader);
    reader.start();
  };
  const onPage = (current: Page) => {
    observePage(current);
    // A page acquisition admitted before interruption can finish after the
    // first close pass; retain and close that late native page as well.
    if (closing) void own(() => current.close()).catch(remember);
  };
  async function prepareClose(current: Page) {
    const reader = readers.get(current);
    if (!reader || current.isClosed()) return;
    await expect
      .poll(
        () =>
          [...reader.ownedReads.values()].filter(
            (read) => !read.settled && !read.retiredBy,
          ).length,
        {
          timeout: 15_000,
          message: "Preference active reads reach their browser terminal",
        },
      )
      .toBe(0);
    reader.prepareRetiredClose();
  }
  async function closeContext(context: BrowserContext) {
    // Scenario finally blocks may reach this before the workflow finalizer.
    // Do not close an intercepted resolver/write before its real response.
    await settle();
    const results = await Promise.allSettled(context.pages().map(prepareClose));
    results.push(...(await Promise.allSettled([context.close()])));
    const failures = results.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    );
    if (failures.length)
      throw new AggregateError(failures, "Preference context did not settle");
  }
  async function installContext(context: BrowserContext) {
    contexts.add(context);
    context.on("page", onPage);
    for (const current of context.pages()) observePage(current);
    await context.route(
      (url) => url.origin === origin,
      (route) => {
        const request = route.request();
        const predecessor = request.redirectedFrom();
        const admitted =
          admittedRequests.has(request) ||
          !closing ||
          Boolean(predecessor && admittedRequests.has(predecessor));
        if (admitted) admittedRequests.add(request);
        return own(async () => {
          if (!admitted) {
            await route.abort("aborted");
            return;
          }
          if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
            await route.continue();
            return;
          }
          try {
            const path = new URL(request.url()).pathname;
            const allowed =
              path === "/api/account/preferences" ||
              (mode === "pins" && path === "/api/workspace/link-pins") ||
              (mode === "bus" && path === "/api/workspace/bus-preferences");
            if (!allowed)
              remember(new Error("Unexpected preference write: " + path));
            const response = await route.fetch({ maxRedirects: 0 });
            // Retain the real status and body, including intentional 400/500 cases.
            await response.body();
            await route.fulfill({ response });
          } catch (error) {
            remember(error);
            try {
              await route.abort("aborted");
            } catch (abortError) {
              remember(abortError);
            }
          }
        });
      },
    );
  }
  function releaseHeld() {
    closing = true;
    for (const release of releases.splice(0)) {
      try {
        release();
      } catch (error) {
        remember(error);
      }
    }
  }
  function finish() {
    finalization ??= (async () => {
      releaseHeld();
      await settle();
      // An interrupted newPage()/event wait may have no Page handle to close.
      // Release its actual native promise after all admitted HTTP/writes settle.
      for (const [context, operations] of browserOperations) {
        if (!operations.size) continue;
        try {
          await context.close();
        } catch (error) {
          remember(error);
        }
      }
      for (const context of contexts) {
        for (const current of context.pages()) {
          try {
            await prepareClose(current);
          } catch (error) {
            remember(error);
          }
          try {
            await current.close();
          } catch (error) {
            remember(error);
          }
        }
      }
      // Page closure releases remaining UI callbacks. Contexts without a
      // pending native acquisition/event wait retain their API response storage
      // until the actual callback finishes reading it and observing state.
      if (actualBody)
        try {
          await actualBody;
        } catch (error) {
          remember(error);
        }
      for (const operations of browserOperations.values()) {
        while (operations.size) await Promise.all([...operations]);
      }
      await settle();
      for (const context of contexts) {
        try {
          await context.close();
        } catch (error) {
          remember(error);
        }
      }
      for (const reader of readers.values()) {
        while (reader.pendingReads.size || reader.pendingNavigations.size)
          await Promise.allSettled([
            ...reader.pendingReads,
            ...reader.pendingNavigations,
          ]);
        reader.stop();
        for (const error of reader.errors) remember(error);
      }
      if (registered) {
        try {
          const response = await observer.get(probePath, probeOptions);
          expect(response.status()).toBe(200);
          const observation = await response.json();
          expect(observation.backgroundErrors).toEqual([]);
          expect(observation.messages).toEqual([]);
          expect(observation.purges).toEqual([]);
          if (completed) expect(observation.requests.length).toBeGreaterThan(0);
          for (const request of observation.requests) {
            expect(request.outcome).toBe("fulfilled");
            expect(request.result).toEqual(expect.any(Number));
            if (["GET", "HEAD"].includes(request.value.method))
              expect(
                request.result,
                `Worker read ${request.value.method} ${request.value.path}`,
              ).toBeLessThan(500);
          }
          const after = await state();
          if (before && completed) {
            if (mode !== "pins") expect(after.pins).toEqual(before.pins);
            if (mode !== "bus") expect(after.bus).toEqual(before.bus);
            if (mode !== "visits") expect(after.visits).toEqual(before.visits);
          }
        } catch (error) {
          remember(error);
        }
        try {
          expect(
            (await observer.delete(probePath, probeOptions)).status(),
          ).toBe(204);
        } catch (error) {
          remember(error);
        }
      }
    })();
    return finalization;
  }
  try {
    // Yield the native fixture before any asynchronous probe or browser setup.
    // Admitted prepare() operations are joined by finish() before page closure.
    await withBrowserWorkflow(page, async (workflow) => {
      try {
        await use({
          headers,
          prepare(work) {
            open();
            return own(work);
          },
          http(work) {
            open();
            return own(async () => {
              const response = await work();
              await response.body();
              return response;
            });
          },
          run(work, kind = "consume") {
            return workflow.run(async () => {
              mode = kind;
              try {
                expect(
                  (await observer.post(probePath, probeOptions)).status(),
                ).toBe(201);
                registered = true;
                open();
                await page.context().setExtraHTTPHeaders(headers);
                await installContext(page.context());
                before = await state();
                await workflow.body(() => {
                  actualBody = Promise.resolve().then(async () => {
                    open();
                    await work();
                    completed = true;
                  });
                  return actualBody;
                });
              } catch (error) {
                remember(error);
              }
              await finish();
              if (errors.length === 1) throw errors[0];
              if (errors.length)
                throw new AggregateError(
                  [...errors],
                  "Preference workflow failed",
                );
            });
          },
          newContext(options = {}) {
            open();
            return own(async () => {
              const context = await browser.newContext({
                ...options,
                baseURL: origin,
                extraHTTPHeaders: { ...options.extraHTTPHeaders, ...headers },
              });
              contexts.add(context);
              if (options.javaScriptEnabled === false) noScript.add(context);
              if (closing) {
                await context.close();
                open();
              }
              await installContext(context);
              if (closing) {
                await context.close();
                open();
              }
              return context;
            });
          },
          newPage(context) {
            return ownBrowserOperation(context, () => context.newPage());
          },
          waitForRequest(context, predicate) {
            return ownBrowserOperation(context, () =>
              context.waitForEvent("request", { predicate }),
            );
          },
          waitForPopup(current) {
            return ownBrowserOperation(current.context(), () =>
              current.waitForEvent("popup"),
            );
          },
          waitForResponse(current, predicate) {
            return ownBrowserOperation(current.context(), () =>
              current.waitForResponse(predicate),
            );
          },
          closeContext,
          expectReadCancellation(current, request) {
            open();
            const reader = readers.get(current);
            if (!reader)
              throw new Error(
                "Cancellation page is not owned by this workflow",
              );
            reader.expectCancellation(request);
          },
          onClosing(release) {
            open();
            releases.push(release);
          },
          async route(target, match, handler) {
            open();
            const owned = (route: Route) => {
              const request = route.request();
              const admitted = admittedRequests.has(request) || !closing;
              if (admitted) admittedRequests.add(request);
              return own(async () => {
                try {
                  if (!admitted)
                    throw new Error(
                      "Controlled preference request began during closing",
                    );
                  await handler(route);
                } catch (error) {
                  remember(error);
                  try {
                    await route.abort("aborted");
                  } catch (abortError) {
                    remember(abortError);
                  }
                }
              });
            };
            controls.push({ target, match, handler: owned });
            await target.route(match, owned);
          },
          async clearRoutes(target) {
            for (let index = controls.length - 1; index >= 0; index--) {
              const entry = controls[index];
              if (entry.target !== target) continue;
              await target.unroute(entry.match, entry.handler);
              controls.splice(index, 1);
            }
            await settle();
          },
        });
      } finally {
        releaseHeld();
      }
    });
  } catch (error) {
    remember(error);
  } finally {
    await finish();
    for (const context of contexts) context.off("page", onPage);
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length)
    throw new AggregateError(errors, "Preference workflow failed");
}
