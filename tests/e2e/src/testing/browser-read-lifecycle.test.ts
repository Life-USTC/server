import { createServer } from "node:http";
import { test as base, expect, type Request } from "@playwright/test";
import { createDeferred } from "../../../shared/deferred";
import { ownBrowserReads } from "../../utils/browser-read-lifecycle";

const test = base.extend<{
  reads: {
    origin: string;
    owner: ReturnType<typeof ownBrowserReads>;
    start: (path?: string) => Promise<Request>;
    release: () => void;
    stopAccepting: () => void;
    cancel: () => Promise<void>;
  };
}>({
  reads: async ({ page }, use) => {
    const release = createDeferred();
    const arrived = createDeferred();
    const server = createServer((request, response) => {
      if (["/slow", "/error", "/redirect"].includes(request.url ?? "")) {
        arrived.resolve();
        void release.promise.then(() => {
          if (request.url === "/error") response.destroy();
          else if (request.url === "/redirect")
            response.writeHead(302, { location: "/completed" }).end();
          else response.writeHead(201).end("completed");
        });
      } else
        response
          .writeHead(200, { "content-type": "text/html" })
          .end("<h1>Page</h1>");
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing server port");
    const origin = `http://127.0.0.1:${address.port}`;
    let accepting = true;
    const owner = ownBrowserReads(page, origin, () => accepting);
    owner.start();
    let cancel: (() => Promise<void>) | undefined;
    try {
      await page.goto(origin);
      await use({
        origin,
        owner,
        release: release.resolve,
        stopAccepting() {
          accepting = false;
        },
        async start(path = "/slow") {
          const requested = page.waitForEvent("request", {
            predicate: (request) => new URL(request.url()).pathname === path,
          });
          void requested.catch(() => undefined);
          const controller = await page.evaluateHandle((path) => {
            const controller = new AbortController();
            void fetch(path, { signal: controller.signal }).catch(
              () => undefined,
            );
            return controller;
          }, path);
          cancel = () =>
            controller.evaluate((controller) => controller.abort());
          await arrived.promise;
          return requested;
        },
        async cancel() {
          if (!cancel) throw new Error("No pending request");
          await cancel();
        },
      });
    } finally {
      release.resolve();
      await page.close();
      while (owner.pendingReads.size || owner.pendingNavigations.size)
        await Promise.allSettled([
          ...owner.pendingReads,
          ...owner.pendingNavigations,
        ]);
      owner.stop();
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  },
});

test("keeps native response status and joins the observation", {
  tag: "@Infrastructure/Runtime",
}, async ({ reads }) => {
  const request = await reads.start();
  reads.release();
  expect((await request.response())?.status()).toBe(201);
  await expect
    .poll(() => reads.owner.ownedReads.get(request)?.settled)
    .toBe(true);
  expect(reads.owner.ownedReads.get(request)?.status).toBe(201);
  expect(reads.owner.errors).toEqual([]);
});

test("closing admission retains an already-owned redirect successor", {
  tag: "@Infrastructure/Runtime",
}, async ({ page, reads }) => {
  const original = await reads.start("/redirect");
  reads.stopAccepting();
  const completed = page.waitForResponse(`${reads.origin}/completed`);
  reads.release();
  const response = await completed;
  expect(response.status()).toBe(200);
  const successor = response.request();
  expect(successor.redirectedFrom()).toBe(original);
  await expect
    .poll(() => reads.owner.ownedReads.get(successor)?.settled)
    .toBe(true);
  expect(reads.owner.ownedReads.get(original)?.status).toBe(302);
  expect(reads.owner.ownedReads.get(successor)?.status).toBe(200);
  expect(reads.owner.errors).toEqual([]);
});

test("propagates an active network failure", {
  tag: "@Infrastructure/Runtime",
}, async ({ reads }) => {
  const request = await reads.start("/error");
  reads.release();
  await expect
    .poll(() => reads.owner.ownedReads.get(request)?.settled)
    .toBe(true);
  expect(request.failure()).not.toBeNull();
  expect(reads.owner.errors.map(String)).toEqual([
    `Error: Browser read failed: ${request.failure()?.errorText}`,
  ]);
});

test("same-document navigation cannot release an active read", {
  tag: "@Infrastructure/Runtime",
}, async ({ page, reads }) => {
  const request = await reads.start();
  await page.evaluate(() => history.pushState({}, "", "#next"));
  expect(reads.owner.ownedReads.get(request)?.retiredBy).toBeUndefined();
  expect(() => reads.owner.prepareRetiredClose()).toThrow(
    "An active document read has no browser terminal",
  );
  reads.release();
  await expect
    .poll(() => reads.owner.ownedReads.get(request)?.settled)
    .toBe(true);
  expect(reads.owner.errors).toEqual([]);
});

test("document replacement releases retired reads on close", {
  tag: "@Infrastructure/Runtime",
}, async ({ page, reads }) => {
  const request = await reads.start();
  await page.goto(`${reads.origin}/next`);
  const owned = reads.owner.ownedReads.get(request);
  expect(owned?.retiredBy?.url).toBe(`${reads.origin}/next`);
  reads.release();
  reads.owner.prepareRetiredClose();
  await page.close();
  await Promise.allSettled([...reads.owner.pendingReads]);
  expect(owned?.settled).toBe(true);
  expect(owned?.canceled).toBe(true);
  expect(reads.owner.errors).toEqual([]);
});

for (const declared of [true, false]) {
  test(`native cancellation settles ${declared ? "after dispatch with an explicit expectation" : "before dispatch without an expectation"}`, {
    tag: "@Infrastructure/Runtime",
  }, async ({ page, reads }) => {
    let request: Request;
    if (declared) {
      request = await reads.start();
      reads.owner.expectCancellation(request);
      await reads.cancel();
    } else {
      await page.route("**/undispatched", (route) => route.abort("aborted"));
      const requested = page.waitForRequest(
        (request) => new URL(request.url()).pathname === "/undispatched",
      );
      await page.evaluate(() => {
        void fetch("/undispatched").catch(() => undefined);
      });
      request = await requested;
    }
    await expect
      .poll(() => reads.owner.ownedReads.get(request)?.settled)
      .toBe(true);
    expect(request.failure()?.errorText).toBe("net::ERR_ABORTED");
    reads.owner.stop();
    expect(reads.owner.ownedReads.get(request)?.canceled).toBe(true);
    expect(reads.owner.ownedReads.get(request)?.status).toBeUndefined();
    expect(reads.owner.errors).toEqual([]);
  });
}

test("a response does not satisfy an expected cancellation", {
  tag: "@Infrastructure/Runtime",
}, async ({ reads }) => {
  const request = await reads.start();
  reads.owner.expectCancellation(request);
  reads.release();
  await expect
    .poll(() => reads.owner.ownedReads.get(request)?.settled)
    .toBe(true);
  reads.owner.stop();
  expect(reads.owner.errors).toHaveLength(1);
  expect(String(reads.owner.errors[0])).toContain(
    "Expected cancellation did not receive native requestfailed",
  );
});

test("removal joins an exact cancellation and preserves action failures", {
  tag: "@Infrastructure/Runtime",
}, async ({ reads }) => {
  const request = await reads.start();
  const failure = new Error("Removal assertion failed");
  await expect(
    reads.owner.duringRemoval([request], async () => {
      await reads.cancel();
      throw failure;
    }),
  ).rejects.toBe(failure);
  expect(reads.owner.errors).toContain(failure);
});

test("removal accepts native abort but rejects other network failures", {
  tag: "@Infrastructure/Runtime",
}, async ({ reads }) => {
  const request = await reads.start();
  await reads.owner.duringRemoval([request], reads.cancel);
  expect(reads.owner.ownedReads.get(request)?.canceled).toBe(true);
  expect(request.failure()?.errorText).toBe("net::ERR_ABORTED");
  expect(reads.owner.errors).toEqual([]);
  const broken = await reads.start("/error");
  await expect(
    reads.owner.duringRemoval([broken], async () => reads.release()),
  ).rejects.toThrow("Component removal read failed:");
  expect(reads.owner.ownedReads.get(broken)?.canceled).toBeUndefined();
});
