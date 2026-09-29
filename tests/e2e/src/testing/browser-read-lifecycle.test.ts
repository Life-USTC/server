import { createServer, type ServerResponse } from "node:http";
import type { Socket } from "node:net";
import { test as base, expect } from "@playwright/test";
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
    armSlowOnNavigation: () => Promise<void>;
    slowArrived: Promise<void>;
    release: () => void;
    completed: Promise<void>;
    navigationArrived: Promise<void>;
    releaseNavigation: () => void;
    admitted: { path: string; requestId: string | undefined }[];
  };
}>({
  nativeReads: async ({ page }, use) => {
    const release = deferred();
    const arrived = deferred();
    const completed = deferred();
    const navigationArrived = deferred();
    const releaseNavigation = deferred();
    const signalArrived = deferred();
    const releaseSignal = deferred();
    const sockets = new Set<Socket>();
    const operations: Promise<void>[] = [];
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
      if (path === "/slow" || path === "/error") {
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
      } else if (path === "/held-navigation" || path === "/held-redirect") {
        navigationArrived.resolve();
        releaseSignal.resolve();
        operations.push(
          releaseNavigation.promise.then(() => {
            if (path === "/held-redirect") {
              response.writeHead(302, { location: "/next" });
              response.end();
            } else html(response);
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
      const owned = ownBrowserReads(page, origin, () => true);
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
        const settled = await Promise.allSettled([page.close()]);
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
