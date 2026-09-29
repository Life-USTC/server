import { createServer, type ServerResponse } from "node:http";
import type { Socket } from "node:net";
import {
  test as base,
  expect,
  type JSHandle,
  type Request,
} from "@playwright/test";
import { ownBrowserReads } from "../../utils/browser-read-lifecycle";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const test = base.extend<{
  nativeReads: {
    origin: string;
    tracking: ReturnType<typeof ownBrowserReads>;
    startSlow: (path?: string) => Promise<void>;
    startCancelableSlow: () => Promise<Request>;
    startRemovableSlow: () => Promise<Request>;
    cancelSlow: () => Promise<void>;
    armCancellationOnNavigation: () => Promise<void>;
    armSlowOnNavigation: () => Promise<void>;
    slowArrived: Promise<void>;
    release: () => void;
    completed: Promise<void>;
    navigationArrived: Promise<void>;
    releaseNavigation: () => void;
    admitted: { path: string; requestId: string | undefined }[];
  };
}>({
  nativeReads: async ({ page, javaScriptEnabled }, use) => {
    const release = deferred();
    const arrived = deferred();
    const completed = deferred();
    const navigationArrived = deferred();
    const releaseNavigation = deferred();
    const signalArrived = deferred();
    const releaseSignal = deferred();
    const sockets = new Set<Socket>();
    const operations: Promise<void>[] = [];
    let controller: JSHandle<AbortController> | undefined;
    const admitted: { path: string; requestId: string | undefined }[] = [];
    const html = (response: ServerResponse, status = 200) => {
      response.writeHead(status, { "content-type": "text/html" });
      response.end(
        "<!doctype html><html><body>Native lifecycle fixture</body></html>",
      );
    };
    const server = createServer((request, response) => {
      const path = new URL(request.url ?? "/", "http://localhost").pathname;
      admitted.push({
        path,
        requestId: request.headers["x-test-request"] as string | undefined,
      });
      if (["/static-script", "/script-csp", "/style-csp"].includes(path)) {
        const headers: Record<string, string> = { "content-type": "text/html" };
        if (path === "/script-csp")
          headers["content-security-policy"] = "script-src 'none'";
        if (path === "/style-csp")
          headers["content-security-policy"] = "style-src 'none'";
        response.writeHead(200, headers);
        response.end(
          path === "/style-csp"
            ? '<!doctype html><html><head><link rel="stylesheet" href="/style.css"></head><body><h1>Static page</h1></body></html>'
            : '<!doctype html><html><head><link rel="modulepreload" href="/script.js"></head><body><h1>Static page</h1><script type="module" src="/script.js"></script></body></html>',
        );
      } else if (path === "/script.js") {
        response.writeHead(200, { "content-type": "text/javascript" });
        response.end("document.body.dataset.executed = 'yes'");
      } else if (path === "/slow" || path === "/error") {
        arrived.resolve();
        operations.push(
          release.promise.then(() => {
            if (path === "/error") response.destroy();
            else {
              response.writeHead(200, { "content-type": "text/plain" });
              response.end("native response");
            }
            completed.resolve();
          }),
        );
      } else if (path === "/navigation-signal") {
        signalArrived.resolve();
        operations.push(
          releaseSignal.promise.then(() => {
            response.writeHead(200, { "content-type": "text/plain" });
            response.end("start the old document's slow read");
          }),
        );
      } else if (
        path === "/held-navigation" ||
        path === "/held-redirect" ||
        path === "/held-no-content" ||
        path === "/held-failed-navigation"
      ) {
        navigationArrived.resolve();
        releaseSignal.resolve();
        operations.push(
          releaseNavigation.promise.then(() => {
            if (path === "/held-redirect") {
              response.writeHead(302, { location: "/next" });
              response.end();
            } else if (path === "/held-no-content") {
              response.writeHead(204);
              response.end();
            } else if (path === "/held-failed-navigation") response.destroy();
            else html(response);
          }),
        );
      } else if (path === "/no-content") {
        response.writeHead(204);
        response.end();
      } else html(response, path === "/created" ? 201 : 200);
    });
    server.on("connection", (socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
    });
    let tracking: ReturnType<typeof ownBrowserReads> | undefined;
    const errors: unknown[] = [];
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
          server.off("error", reject);
          resolve();
        });
      });
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Native server has no port");
      const origin = `http://127.0.0.1:${address.port}`;
      const owned = ownBrowserReads(page, origin, () => true, {
        javaScriptEnabled,
      });
      tracking = owned;
      owned.start();
      await page.route(
        (url) => url.origin === origin,
        async (route) => {
          const read = owned.ownedReads.get(route.request());
          if (!read)
            throw new Error(
              "Native route must be admitted before continuation",
            );
          await route.continue({
            headers: {
              ...route.request().headers(),
              "x-test-request": read.requestId,
            },
          });
        },
      );
      await use({
        origin,
        tracking: owned,
        admitted,
        release: release.resolve,
        completed: completed.promise,
        navigationArrived: navigationArrived.promise,
        releaseNavigation: releaseNavigation.resolve,
        slowArrived: arrived.promise,
        async startCancelableSlow() {
          const requested = page.waitForEvent("request", {
            predicate: (request) => new URL(request.url()).pathname === "/slow",
          });
          void requested.catch(() => undefined);
          controller = await page.evaluateHandle(() => {
            const controller = new AbortController();
            void fetch("/slow", { signal: controller.signal }).catch(
              () => undefined,
            );
            return controller;
          });
          await arrived.promise;
          return requested;
        },
        async startRemovableSlow() {
          const requested = page.waitForEvent("request", {
            predicate: (request) => new URL(request.url()).pathname === "/slow",
          });
          void requested.catch(() => undefined);
          controller = await page.evaluateHandle(() => {
            const controller = new AbortController();
            customElements.define(
              "owned-native-read",
              class extends HTMLElement {
                disconnectedCallback() {
                  controller.abort();
                }
              },
            );
            const owner = document.createElement("owned-native-read");
            owner.id = "owned-native-read";
            document.body.append(owner);
            void fetch("/slow", { signal: controller.signal }).catch(
              () => undefined,
            );
            return controller;
          });
          await arrived.promise;
          return requested;
        },
        async cancelSlow() {
          if (!controller) throw new Error("Cancelable read was not started");
          await controller.evaluate((controller) => controller.abort());
        },
        async armCancellationOnNavigation() {
          if (!controller) throw new Error("Cancelable read was not started");
          await controller.evaluate((controller) => {
            void fetch("/navigation-signal")
              .then((response) => response.text())
              .then(() => controller.abort())
              .catch(() => undefined);
          });
          await signalArrived.promise;
        },
        async armSlowOnNavigation() {
          await page.evaluate(() => {
            void fetch("/navigation-signal")
              .then((response) => response.text())
              .then(() => fetch("/slow"))
              .catch(() => undefined);
          });
          await signalArrived.promise;
        },
        async startSlow(path = "/slow") {
          await page.evaluate((path) => {
            void fetch(path).catch(() => undefined);
          }, path);
          await arrived.promise;
        },
      });
    } catch (error) {
      errors.push(error);
    } finally {
      release.resolve();
      releaseNavigation.resolve();
      releaseSignal.resolve();
      try {
        const settled = await Promise.allSettled([
          ...(controller ? [controller.dispose()] : []),
          page.close(),
        ]);
        errors.push(
          ...settled.flatMap((result) =>
            result.status === "rejected" ? [result.reason] : [],
          ),
        );
        while (
          tracking &&
          (tracking.pendingReads.size || tracking.pendingNavigations.size)
        )
          await Promise.allSettled([
            ...tracking.pendingReads,
            ...tracking.pendingNavigations,
          ]);
      } finally {
        tracking?.stop();
        for (const socket of sockets) socket.destroy();
        if (server.listening)
          try {
            await new Promise<void>((resolve, reject) =>
              server.close((error) => (error ? reject(error) : resolve())),
            );
          } catch (error) {
            errors.push(error);
          }
        // Page closure can race a final signal-triggered handler. Stop new
        // connections before joining every server operation that was admitted.
        const settled = await Promise.allSettled(operations);
        errors.push(
          ...settled.flatMap((result) =>
            result.status === "rejected" ? [result.reason] : [],
          ),
        );
      }
    }
    if (errors.length)
      throw new AggregateError(errors, "Native browser fixture failed");
  },
});

test("browser-reads.successful-response-keeps-native-status", async ({
  page,
  nativeReads: fixture,
}) => {
  await page.goto(`${fixture.origin}/source`);
  await fixture.startSlow();
  fixture.release();
  await expect
    .poll(
      () =>
        fixture.tracking.reads.find((read) => read.path === "/slow")?.status,
    )
    .toBe(200);
  expect(fixture.tracking.errors).toEqual([]);
  expect(fixture.tracking.retiredReads).toEqual([]);
  fixture.tracking.prepareRetiredClose();
  const request = page.request;
  await page.close();
  // The observer's API context belongs to BrowserContext, not the closed Page.
  expect((await request.get(`${fixture.origin}/health`)).status()).toBe(200);
});

test("browser-reads.retired-document-joins-original-close-rejection", async ({
  page,
  nativeReads: fixture,
}) => {
  await page.goto(`${fixture.origin}/source`);
  await fixture.startSlow();
  const owned = [...fixture.tracking.ownedReads.values()].find(
    (read) => read.path === "/slow",
  );
  expect(owned).toBeDefined();
  expect(
    fixture.admitted.find((read) => read.path === "/slow")?.requestId,
  ).toBe(owned?.requestId);
  await page.goto(`${fixture.origin}/next`);
  fixture.release();
  await fixture.completed;
  expect(owned?.retiredBy?.order).toBeGreaterThan(owned?.order ?? 0);
  expect(owned?.settled).toBe(false);
  fixture.tracking.prepareRetiredClose();
  await page.close();
  while (
    fixture.tracking.pendingReads.size ||
    fixture.tracking.pendingNavigations.size
  )
    await Promise.allSettled([
      ...fixture.tracking.pendingReads,
      ...fixture.tracking.pendingNavigations,
    ]);
  expect(fixture.tracking.errors).toEqual([]);
  expect(
    fixture.tracking.reads.filter((read) => read.path === "/slow"),
  ).toEqual([]);
  expect(fixture.tracking.retiredReads).toEqual([
    expect.objectContaining({
      requestId: owned?.requestId,
      path: "/slow",
      outcome: "retired-document/page-close",
      error:
        "request.response: Target page, context or browser has been closed",
    }),
  ]);
});

test("browser-reads.active-network-error-remains-an-error", async ({
  page,
  nativeReads: fixture,
}) => {
  await page.goto(`${fixture.origin}/source`);
  await fixture.startSlow("/error");
  fixture.release();
  await expect.poll(() => fixture.tracking.errors.length).toBe(1);
  expect(String(fixture.tracking.errors[0])).toContain("Calendar read failed:");
  expect(fixture.tracking.retiredReads).toEqual([]);
  expect(
    fixture.tracking.reads.filter((read) => read.path === "/error"),
  ).toEqual([]);
});

test("browser-reads.same-document-navigation-cannot-retire-a-read", async ({
  page,
  nativeReads: fixture,
}) => {
  await page.goto(`${fixture.origin}/source`);
  await fixture.startSlow();
  await page.evaluate(() => history.pushState({}, "", "#next"));
  const owned = [...fixture.tracking.ownedReads.values()].find(
    (read) => read.path === "/slow",
  );
  expect(owned?.retiredBy).toBeUndefined();
  expect(() => fixture.tracking.prepareRetiredClose()).toThrow(
    "An active document read has no browser terminal",
  );
  fixture.release();
  await expect.poll(() => owned?.settled).toBe(true);
  expect(fixture.tracking.errors).toEqual([]);
});

for (const [destination, title] of [
  [
    "/held-navigation",
    "browser-reads.provisional-navigation-is-not-retirement-proof",
  ],
  [
    "/held-redirect",
    "browser-reads.redirect-chain-keeps-root-admission-boundary",
  ],
] as const)
  test(title, async ({ page, nativeReads: fixture }) => {
    await page.goto(`${fixture.origin}/source`);
    // Arm the old document while its execution context is available. The real
    // server releases this signal only after receiving the root navigation.
    await fixture.armSlowOnNavigation();
    const navigation = page.goto(`${fixture.origin}${destination}`);
    void navigation.catch(() => undefined);
    try {
      await fixture.navigationArrived;
      await fixture.slowArrived;
      const root = [...fixture.tracking.ownedReads.values()].find(
        (read) => read.path === destination,
      );
      const slow = [...fixture.tracking.ownedReads.values()].find(
        (read) => read.path === "/slow",
      );
      expect(slow?.order).toBeGreaterThan(
        root?.order ?? Number.POSITIVE_INFINITY,
      );
      fixture.releaseNavigation();
      await navigation;
      if (destination === "/held-redirect") {
        const successor = [...fixture.tracking.ownedReads.values()].find(
          (read) => read.path === "/next",
        );
        expect(slow?.order).toBeLessThan(successor?.order ?? 0);
      }
      fixture.release();
      await fixture.completed;
      const owned = [...fixture.tracking.ownedReads.values()].find(
        (read) => read.path === "/slow",
      );
      expect(owned?.retiredBy).toBeUndefined();
      expect(() => fixture.tracking.prepareRetiredClose()).toThrow(
        "An active document read has no browser terminal",
      );
      await page.close();
      while (
        fixture.tracking.pendingReads.size ||
        fixture.tracking.pendingNavigations.size
      )
        await Promise.allSettled([
          ...fixture.tracking.pendingReads,
          ...fixture.tracking.pendingNavigations,
        ]);
      expect(fixture.tracking.retiredReads).toEqual([]);
      expect(fixture.tracking.errors).toHaveLength(1);
      expect(String(fixture.tracking.errors[0])).toContain(
        "Target page, context or browser has been closed",
      );
    } finally {
      fixture.releaseNavigation();
      await Promise.allSettled([navigation]);
    }
  });

test("browser-reads.successful-non200-status-is-preserved", async ({
  page,
  nativeReads: fixture,
}) => {
  await page.goto(`${fixture.origin}/created`);
  await expect
    .poll(
      () =>
        fixture.tracking.reads.find((read) => read.path === "/created")?.status,
    )
    .toBe(201);
  expect(fixture.tracking.errors).toEqual([]);
});

test("browser-reads.noncommitting204-cannot-retire-on-same-document-url", async ({
  page,
  nativeReads: fixture,
}) => {
  await page.goto(`${fixture.origin}/source`);
  await fixture.startSlow();
  await page.goto(`${fixture.origin}/no-content`).catch(() => undefined);
  expect(page.url()).toBe(`${fixture.origin}/source`);
  await expect
    .poll(
      () =>
        fixture.tracking.reads.find((read) => read.path === "/no-content")
          ?.status,
    )
    .toBe(204);
  await page.evaluate(() => history.pushState({}, "", "/no-content"));
  const owned = [...fixture.tracking.ownedReads.values()].find(
    (read) => read.path === "/slow",
  );
  expect(owned?.retiredBy).toBeUndefined();
  expect(() => fixture.tracking.prepareRetiredClose()).toThrow(
    "An active document read has no browser terminal",
  );
  fixture.release();
  await expect.poll(() => owned?.settled).toBe(true);
  expect(fixture.tracking.retiredReads).toEqual([]);
});

test("browser-reads.enabled-script-keeps-real-response", async ({
  page,
  nativeReads: fixture,
}) => {
  await page.goto(`${fixture.origin}/static-script`);
  await expect(page.locator("body")).toHaveAttribute("data-executed", "yes");
  await expect
    .poll(
      () =>
        fixture.tracking.reads.find((read) => read.path === "/script.js")
          ?.status,
    )
    .toBe(200);
  expect(fixture.tracking.blockedReads).toEqual([]);
  expect(fixture.tracking.errors).toEqual([]);
  expect(fixture.admitted.some((read) => read.path === "/script.js")).toBe(
    true,
  );
});

test("browser-reads.enabled-script-csp-remains-an-error", async ({
  page,
  nativeReads: fixture,
}) => {
  await page.goto(`${fixture.origin}/script-csp`);
  await expect.poll(() => fixture.tracking.errors.length).toBeGreaterThan(0);
  expect(fixture.tracking.errors.map(String)).toEqual(
    expect.arrayContaining(["Error: Calendar read failed: csp"]),
  );
  expect(fixture.tracking.blockedReads).toEqual([]);
  expect(
    fixture.tracking.reads.filter((read) => read.path === "/script.js"),
  ).toEqual([]);
  expect(fixture.admitted.some((read) => read.path === "/script.js")).toBe(
    false,
  );
});

test.describe("JavaScript disabled explicitly", () => {
  test.use({ javaScriptEnabled: false });

  test("browser-reads.disabled-script-records-browser-block-without-http-success", async ({
    page,
    nativeReads: fixture,
  }) => {
    await page.goto(`${fixture.origin}/static-script`);
    await expect(
      page.getByRole("heading", { name: "Static page" }),
    ).toBeVisible();
    await expect.poll(() => fixture.tracking.blockedReads.length).toBe(1);
    expect(fixture.tracking.blockedReads).toEqual([
      expect.objectContaining({
        path: "/script.js",
        method: "GET",
        resourceType: "script",
        outcome: "script-disabled/csp",
        error: "csp",
      }),
    ]);
    expect(fixture.tracking.blockedReads[0]).not.toHaveProperty("status");
    expect(fixture.tracking.errors).toEqual([]);
    expect(
      fixture.tracking.reads.filter((read) => read.path === "/script.js"),
    ).toEqual([]);
    expect(fixture.admitted.some((read) => read.path === "/script.js")).toBe(
      false,
    );
    expect(await page.locator("body").getAttribute("data-executed")).toBeNull();
  });

  test("browser-reads.disabled-javascript-does-not-hide-stylesheet-csp", async ({
    page,
    nativeReads: fixture,
  }) => {
    await page.goto(`${fixture.origin}/style-csp`);
    await expect.poll(() => fixture.tracking.errors.length).toBe(1);
    expect(fixture.tracking.errors.map(String)).toEqual([
      "Error: Calendar read failed: csp",
    ]);
    expect(fixture.tracking.blockedReads).toEqual([]);
    expect(
      fixture.tracking.reads.filter((read) => read.path === "/style.css"),
    ).toEqual([]);
    expect(fixture.admitted.some((read) => read.path === "/style.css")).toBe(
      false,
    );
  });
});

test("browser-reads.expected-cancellation-requires-the-native-request-failure", async ({
  page,
  nativeReads: fixture,
}) => {
  await page.goto(`${fixture.origin}/source`);
  const request = await fixture.startCancelableSlow();
  const owned = fixture.tracking.ownedReads.get(request);
  fixture.tracking.expectCancellation(request);
  const failed = page.waitForEvent("requestfailed", {
    predicate: (incoming) => incoming === request,
  });
  void failed.catch(() => undefined);
  await fixture.cancelSlow();
  expect(await failed).toBe(request);
  expect(request.failure()?.errorText).toBe("net::ERR_ABORTED");
  fixture.release();
  await fixture.completed;
  await expect.poll(() => owned?.settled).toBe(true);
  fixture.tracking.stop();
  expect(fixture.tracking.errors).toEqual([]);
  expect(fixture.tracking.canceledReads).toEqual([
    {
      requestId: owned?.requestId,
      method: "GET",
      path: "/slow",
      order: owned?.order,
      outcome: "expected-request-cancellation",
      error: "net::ERR_ABORTED",
    },
  ]);
  expect(fixture.tracking.retiredReads).toEqual([]);
  expect(
    fixture.tracking.reads.filter((read) => read.path === "/slow"),
  ).toEqual([]);
});

test("browser-reads.undeclared-active-cancellation-remains-an-error", async ({
  page,
  nativeReads: fixture,
}) => {
  await page.goto(`${fixture.origin}/source`);
  const request = await fixture.startCancelableSlow();
  const owned = fixture.tracking.ownedReads.get(request);
  const failed = page.waitForEvent("requestfailed", {
    predicate: (incoming) => incoming === request,
  });
  void failed.catch(() => undefined);
  await fixture.cancelSlow();
  expect(await failed).toBe(request);
  fixture.release();
  await fixture.completed;
  await expect.poll(() => owned?.settled).toBe(true);
  fixture.tracking.stop();
  expect(fixture.tracking.errors.map(String)).toEqual([
    "Error: Calendar read failed: net::ERR_ABORTED",
  ]);
  expect(fixture.tracking.canceledReads).toEqual([]);
  expect(fixture.tracking.retiredReads).toEqual([]);
  expect(
    fixture.tracking.reads.filter((read) => read.path === "/slow"),
  ).toEqual([]);
});

test("browser-reads.success-does-not-satisfy-a-declared-cancellation", async ({
  page,
  nativeReads: fixture,
}) => {
  await page.goto(`${fixture.origin}/source`);
  const request = await fixture.startCancelableSlow();
  const owned = fixture.tracking.ownedReads.get(request);
  fixture.tracking.expectCancellation(request);
  fixture.release();
  await fixture.completed;
  expect((await request.response())?.status()).toBe(200);
  await expect.poll(() => owned?.settled).toBe(true);
  fixture.tracking.stop();
  expect(request.failure()).toBeNull();
  expect(fixture.tracking.errors).toHaveLength(1);
  expect(String(fixture.tracking.errors[0])).toContain(
    "Expected cancellation did not receive native requestfailed net::ERR_ABORTED",
  );
  expect(fixture.tracking.canceledReads).toEqual([]);
  expect(fixture.tracking.retiredReads).toEqual([]);
  expect(
    fixture.tracking.reads.filter((read) => read.path === "/slow"),
  ).toEqual([
    expect.objectContaining({ requestId: owned?.requestId, status: 200 }),
  ]);
});

test("browser-reads.redirect-abort-requires-the-original-navigation-root", async ({
  page,
  nativeReads: fixture,
}) => {
  await page.goto(`${fixture.origin}/source`);
  const request = await fixture.startCancelableSlow();
  const owned = fixture.tracking.ownedReads.get(request);
  await fixture.armCancellationOnNavigation();
  const failed = page.waitForEvent("requestfailed", {
    predicate: (incoming) => incoming === request,
  });
  void failed.catch(() => undefined);
  const navigation = page.goto(`${fixture.origin}/held-redirect`);
  void navigation.catch(() => undefined);
  try {
    await fixture.navigationArrived;
    expect(await failed).toBe(request);
    expect(request.failure()?.errorText).toBe("net::ERR_ABORTED");
    expect(owned?.retiredBy).toBeUndefined();
    const root = [...fixture.tracking.ownedReads.values()].find(
      (read) => read.path === "/held-redirect",
    );
    expect(root?.order).toBeGreaterThan(owned?.order ?? 0);
    fixture.releaseNavigation();
    await navigation;
    const redirected = [...fixture.tracking.ownedReads.values()].find(
      (read) => read.path === "/next",
    );
    expect(redirected?.order).toBeGreaterThan(root?.order ?? 0);
    expect(redirected?.requestId).toBe(root?.requestId);
    expect(page.url()).toBe(`${fixture.origin}/next`);
    fixture.release();
    await fixture.completed;
    await expect.poll(() => owned?.settled).toBe(true);
    fixture.tracking.stop();
    expect(owned?.retiredBy).toEqual({
      order: root?.order,
      url: `${fixture.origin}/next`,
    });
    expect(fixture.tracking.navigationCommits).toContainEqual({
      order: root?.order,
      url: `${fixture.origin}/next`,
    });
    expect(
      fixture.tracking.reads.filter((read) =>
        ["/held-redirect", "/next"].includes(read.path),
      ),
    ).toEqual([
      expect.objectContaining({ path: "/held-redirect", status: 302 }),
      expect.objectContaining({ path: "/next", status: 200 }),
    ]);
    expect(fixture.tracking.errors).toEqual([]);
    expect(fixture.tracking.canceledReads).toEqual([]);
    expect(fixture.tracking.retiredReads).toEqual([
      expect.objectContaining({
        requestId: owned?.requestId,
        path: "/slow",
        retiredBy: owned?.retiredBy,
        outcome: "retired-document/request-abort",
        error: "net::ERR_ABORTED",
      }),
    ]);
    expect(
      fixture.tracking.reads.filter((read) => read.path === "/slow"),
    ).toEqual([]);
  } finally {
    fixture.releaseNavigation();
    await Promise.allSettled([navigation]);
  }
});

test("browser-reads.precommit-abort-joins-only-the-owned-navigation", async ({
  page,
  nativeReads: fixture,
}) => {
  await page.goto(`${fixture.origin}/source`);
  const request = await fixture.startCancelableSlow();
  const owned = fixture.tracking.ownedReads.get(request);
  await fixture.armCancellationOnNavigation();
  const failed = page.waitForEvent("requestfailed", {
    predicate: (incoming) => incoming === request,
  });
  void failed.catch(() => undefined);
  const navigation = page.goto(`${fixture.origin}/held-navigation`);
  void navigation.catch(() => undefined);
  try {
    await fixture.navigationArrived;
    expect(await failed).toBe(request);
    expect(owned?.retiredBy).toBeUndefined();
    expect(owned?.settled).toBe(false);
    fixture.releaseNavigation();
    await navigation;
    fixture.release();
    await fixture.completed;
    await expect.poll(() => owned?.settled).toBe(true);
    fixture.tracking.stop();
    expect(fixture.tracking.errors).toEqual([]);
    expect(fixture.tracking.canceledReads).toEqual([]);
    expect(fixture.tracking.retiredReads).toEqual([
      expect.objectContaining({
        requestId: owned?.requestId,
        path: "/slow",
        retiredBy: owned?.retiredBy,
        outcome: "retired-document/request-abort",
        error: "net::ERR_ABORTED",
      }),
    ]);
    expect(owned?.retiredBy?.order).toBeGreaterThan(owned?.order ?? 0);
  } finally {
    fixture.releaseNavigation();
    await Promise.allSettled([navigation]);
  }
});

for (const destination of [
  "/held-no-content",
  "/held-failed-navigation",
] as const)
  test(`browser-reads.${destination.slice(1)}-does-not-excuse-an-abort`, async ({
    page,
    nativeReads: fixture,
  }) => {
    await page.goto(`${fixture.origin}/source`);
    const request = await fixture.startCancelableSlow();
    const owned = fixture.tracking.ownedReads.get(request);
    await fixture.armCancellationOnNavigation();
    const failed = page.waitForEvent("requestfailed", {
      predicate: (incoming) => incoming === request,
    });
    void failed.catch(() => undefined);
    const navigation = page.goto(`${fixture.origin}${destination}`);
    void navigation.catch(() => undefined);
    try {
      await fixture.navigationArrived;
      expect(await failed).toBe(request);
      expect(owned?.retiredBy).toBeUndefined();
      fixture.releaseNavigation();
      await Promise.allSettled([navigation]);
      if (destination === "/held-no-content") {
        // Even the attempted URL in history does not establish a document.
        await page.evaluate((destination) => {
          history.pushState({}, "", destination);
        }, destination);
        expect(page.url()).toBe(`${fixture.origin}${destination}`);
      }
      fixture.release();
      await fixture.completed;
      await page.close();
      while (
        fixture.tracking.pendingReads.size ||
        fixture.tracking.pendingNavigations.size
      )
        await Promise.allSettled([
          ...fixture.tracking.pendingReads,
          ...fixture.tracking.pendingNavigations,
        ]);
      fixture.tracking.stop();
      expect(owned?.retiredBy).toBeUndefined();
      expect(fixture.tracking.retiredReads).toEqual([]);
      expect(fixture.tracking.canceledReads).toEqual([]);
      expect(fixture.tracking.errors.map(String)).toContain(
        "Error: Calendar read failed: net::ERR_ABORTED",
      );
      expect(
        fixture.tracking.reads.filter((read) => read.path === "/slow"),
      ).toEqual([]);
    } finally {
      fixture.releaseNavigation();
      await Promise.allSettled([navigation]);
    }
  });

test("browser-reads.later-navigation-cannot-retroactively-excuse-an-abort", async ({
  page,
  nativeReads: fixture,
}) => {
  await page.goto(`${fixture.origin}/source`);
  const request = await fixture.startCancelableSlow();
  const owned = fixture.tracking.ownedReads.get(request);
  await fixture.armCancellationOnNavigation();
  const failed = page.waitForEvent("requestfailed", {
    predicate: (incoming) => incoming === request,
  });
  void failed.catch(() => undefined);
  const firstNavigation = page.goto(`${fixture.origin}/held-no-content`);
  void firstNavigation.catch(() => undefined);
  try {
    await fixture.navigationArrived;
    expect(await failed).toBe(request);
    expect(request.failure()?.errorText).toBe("net::ERR_ABORTED");
    const first = [...fixture.tracking.ownedReads.values()].find(
      (read) => read.path === "/held-no-content",
    );
    expect(first?.order).toBeGreaterThan(owned?.order ?? 0);
    expect(owned?.retiredBy).toBeUndefined();
    // B is admitted after the exact read failure while A is still held.
    // A may reject as soon as B supersedes it; no pending state after a 204
    // response or deterministic mutation coverage is assumed here.
    expect(
      fixture.tracking.navigationCommits.some(
        (commit) => commit.order === first?.order,
      ),
    ).toBe(false);
    await page.goto(`${fixture.origin}/next`);
    const second = [...fixture.tracking.ownedReads.values()].find(
      (read) => read.path === "/next",
    );
    expect(second?.order).toBeGreaterThan(first?.order ?? 0);
    fixture.releaseNavigation();
    await Promise.allSettled([firstNavigation]);
    fixture.release();
    await fixture.completed;
    await expect.poll(() => owned?.settled).toBe(true);
    fixture.tracking.stop();
    expect(owned?.retiredBy?.order).toBe(second?.order);
    expect(
      fixture.tracking.navigationCommits.some(
        (commit) => commit.order === first?.order,
      ),
    ).toBe(false);
    expect(fixture.tracking.canceledReads).toEqual([]);
    expect(fixture.tracking.retiredReads).toEqual([]);
    expect(fixture.tracking.errors.map(String)).toContain(
      "Error: Calendar read failed: net::ERR_ABORTED",
    );
    expect(
      fixture.tracking.reads.filter((read) => read.path === "/slow"),
    ).toEqual([]);
  } finally {
    fixture.releaseNavigation();
    await Promise.allSettled([firstNavigation]);
  }
});

test("browser-reads.component-removal-joins-native-cancellation-before-return", async ({
  page,
  nativeReads: fixture,
}) => {
  await page.goto(`${fixture.origin}/source`);
  const request = await fixture.startRemovableSlow();
  const owned = fixture.tracking.ownedReads.get(request);
  expect(fixture.tracking.activeReads()).toContain(request);
  await fixture.tracking.duringRemoval([request], async () => {
    await page
      .locator("#owned-native-read")
      .evaluate((element) => element.remove());
    await expect(page.locator("#owned-native-read")).toHaveCount(0);
  });
  expect(page.isClosed()).toBe(false);
  expect(request.failure()?.errorText).toBe("net::ERR_ABORTED");
  expect(owned?.settled).toBe(true);
  expect(owned?.retiredBy).toBeUndefined();
  expect(fixture.tracking.errors).toEqual([]);
  expect(fixture.tracking.removedReads).toEqual([
    {
      requestId: owned?.requestId,
      method: "GET",
      path: "/slow",
      order: owned?.order,
      outcome: "removed-component/request-abort",
      error: "net::ERR_ABORTED",
    },
  ]);
  expect(fixture.tracking.canceledReads).toEqual([]);
  expect(fixture.tracking.retiredReads).toEqual([]);
  expect(
    fixture.tracking.reads.filter((read) => read.path === "/slow"),
  ).toEqual([]);
  fixture.release();
  await fixture.completed;
});

test("browser-reads.component-removal-preserves-a-successful-response-race", async ({
  page,
  nativeReads: fixture,
}) => {
  await page.goto(`${fixture.origin}/source`);
  const request = await fixture.startRemovableSlow();
  const owned = fixture.tracking.ownedReads.get(request);
  const finished = page.waitForEvent("requestfinished", {
    predicate: (incoming) => incoming === request,
  });
  void finished.catch(() => undefined);
  await fixture.tracking.duringRemoval([request], async () => {
    fixture.release();
    await fixture.completed;
    expect(await finished).toBe(request);
    await page
      .locator("#owned-native-read")
      .evaluate((element) => element.remove());
    await expect(page.locator("#owned-native-read")).toHaveCount(0);
  });
  expect(request.failure()).toBeNull();
  expect(fixture.tracking.errors).toEqual([]);
  expect(fixture.tracking.removedReads).toEqual([]);
  expect(fixture.tracking.canceledReads).toEqual([]);
  expect(fixture.tracking.retiredReads).toEqual([]);
  expect(
    fixture.tracking.reads.filter((read) => read.path === "/slow"),
  ).toEqual([
    expect.objectContaining({ requestId: owned?.requestId, status: 200 }),
  ]);
});

test("browser-reads.component-removal-rejects-an-unexpected-network-failure", async ({
  page,
  nativeReads: fixture,
}) => {
  await page.goto(`${fixture.origin}/source`);
  const requested = page.waitForEvent("request", {
    predicate: (request) => new URL(request.url()).pathname === "/error",
  });
  void requested.catch(() => undefined);
  await fixture.startSlow("/error");
  const request = await requested;
  await expect(
    fixture.tracking.duringRemoval([request], async () => {
      fixture.release();
      await fixture.completed;
    }),
  ).rejects.toThrow("Component removal read failed:");
  expect(request.failure()?.errorText).not.toBe("net::ERR_ABORTED");
  expect(fixture.tracking.errors.map(String)).toContain(
    `Error: Component removal read failed: ${request.failure()?.errorText}`,
  );
  expect(fixture.tracking.removedReads).toEqual([]);
  expect(fixture.tracking.canceledReads).toEqual([]);
  expect(
    fixture.tracking.reads.filter((read) => read.path === "/error"),
  ).toEqual([]);
});

test("browser-reads.component-removal-propagates-the-action-error", async ({
  page,
  nativeReads: fixture,
}) => {
  await page.goto(`${fixture.origin}/source`);
  const request = await fixture.startRemovableSlow();
  const actionError = new Error("Removal assertion failed");
  await expect(
    fixture.tracking.duringRemoval([request], async () => {
      await page
        .locator("#owned-native-read")
        .evaluate((element) => element.remove());
      throw actionError;
    }),
  ).rejects.toBe(actionError);
  expect(fixture.tracking.errors).toContain(actionError);
  expect(fixture.tracking.removedReads).toEqual([]);
  expect(fixture.tracking.canceledReads).toEqual([]);
  fixture.release();
  await fixture.completed;
});

test("browser-reads.page-close-cannot-finalize-component-removal", async ({
  page,
  nativeReads: fixture,
}) => {
  await page.goto(`${fixture.origin}/source`);
  const request = await fixture.startRemovableSlow();
  await expect(
    fixture.tracking.duringRemoval([request], async () => {
      await page.close();
    }),
  ).rejects.toThrow("Removal action closed its page or stopped its observer");
  expect(fixture.tracking.removedReads).toEqual([]);
  expect(fixture.tracking.canceledReads).toEqual([]);
  expect(fixture.tracking.retiredReads).toEqual([]);
  expect(fixture.tracking.errors.map(String)).toContain(
    "Error: Removal action closed its page or stopped its observer",
  );
  fixture.release();
  await fixture.completed;
});

test("browser-reads.component-removal-does-not-own-late-admitted-reads", async ({
  page,
  nativeReads: fixture,
}) => {
  await page.goto(`${fixture.origin}/source`);
  await fixture.tracking.duringRemoval([], async () => {
    const request = await fixture.startRemovableSlow();
    const failed = page.waitForEvent("requestfailed", {
      predicate: (incoming) => incoming === request,
    });
    void failed.catch(() => undefined);
    await page
      .locator("#owned-native-read")
      .evaluate((element) => element.remove());
    expect(await failed).toBe(request);
    await expect
      .poll(() => fixture.tracking.ownedReads.get(request)?.settled)
      .toBe(true);
  });
  expect(fixture.tracking.errors.map(String)).toEqual([
    "Error: Calendar read failed: net::ERR_ABORTED",
  ]);
  expect(fixture.tracking.removedReads).toEqual([]);
  expect(fixture.tracking.canceledReads).toEqual([]);
  fixture.release();
  await fixture.completed;
});

test("browser-reads.component-removal-rejects-already-settled-ownership", async ({
  page,
  nativeReads: fixture,
}) => {
  await page.goto(`${fixture.origin}/source`);
  const request = await fixture.startCancelableSlow();
  fixture.release();
  await fixture.completed;
  await expect
    .poll(() => fixture.tracking.ownedReads.get(request)?.settled)
    .toBe(true);
  let actionRan = false;
  await expect(
    fixture.tracking.duringRemoval([request], async () => {
      actionRan = true;
    }),
  ).rejects.toThrow(
    "Removal requires distinct active owned reads before the action",
  );
  expect(actionRan).toBe(false);
  expect(fixture.tracking.removedReads).toEqual([]);
  expect(fixture.tracking.errors).toEqual([]);
});
