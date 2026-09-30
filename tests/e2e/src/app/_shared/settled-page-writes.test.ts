import { createServer } from "node:http";
import { test as base, expect, type Page } from "@playwright/test";
import { createDeferred } from "../../../../shared/deferred";
import { withBrowserWorkflow } from "../../../utils/browser-workflow";
import { withSettledPageWrites } from "../../../utils/settled-page-writes";

function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

type Write = { method: string; path: string; body: string };
type Endpoint = {
  origin: string;
  writes: Write[];
  received: Promise<void>;
  responded: Promise<void>;
  release: () => void;
};

const test = base.extend<{ endpoint: Endpoint }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright reads destructuring as the fixture dependency list.
  endpoint: async ({}, use) => {
    const received = gate();
    const responded = gate();
    const responseAllowed = gate();
    const writes: Write[] = [];
    const server = createServer((request, response) => {
      if (request.url === "/") {
        response.setHeader("content-type", "text/html");
        response.end(
          '<button id="write">Write</button><button id="late">Write during teardown</button>',
        );
        return;
      }
      let body = "";
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => {
        writes.push({
          method: request.method ?? "",
          path: request.url ?? "",
          body,
        });
        received.resolve();
        if (request.url === "/disconnect") {
          request.socket.destroy();
          return;
        }
        void responseAllowed.promise.then(() => {
          response.once("finish", responded.resolve);
          response.setHeader("content-type", "application/json");
          response.end("{}");
        });
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    try {
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Expected a private HTTP server port");
      await use({
        origin: `http://127.0.0.1:${address.port}`,
        writes,
        received: received.promise,
        responded: responded.promise,
        release: responseAllowed.resolve,
      });
    } finally {
      responseAllowed.resolve();
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  },
});

async function openWriter(
  page: Page,
  endpoint: Endpoint,
  method = "POST",
  path = "/write",
) {
  await page.goto(endpoint.origin);
  await page.evaluate(
    ({ method, path }) => {
      document.querySelector("#write")?.addEventListener("click", () => {
        void fetch(path, { method, body: "owned write" }).catch(() => {});
      });
      document.querySelector("#late")?.addEventListener("click", () => {
        void fetch("/late", { method: "POST", body: "late write" }).catch(
          () => {},
        );
      });
    },
    { method, path },
  );
}

for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
  test(`${method} body failure settles exactly one write before page close`, async ({
    page,
    endpoint,
  }) => {
    const bodyFinished = gate();
    const bodyError = new Error("Intentional body failure");
    const events: string[] = [];
    void endpoint.responded.then(() => events.push("server response"));
    page.on("close", () => events.push("close"));
    const failure = withSettledPageWrites(page, /\/write$/, async () => {
      await openWriter(page, endpoint, method);
      await page.getByRole("button", { name: "Write", exact: true }).click();
      await endpoint.received;
      bodyFinished.resolve();
      throw bodyError;
    }).catch((error: unknown) => error);

    await bodyFinished.promise;
    endpoint.release();
    expect(await failure).toBe(bodyError);
    await endpoint.responded;
    expect(endpoint.writes).toEqual([
      { method, path: "/write", body: "owned write" },
    ]);
    expect(events).toEqual(["server response", "close"]);
  });
}

test("fetch failure aborts the original browser write before page close", async ({
  page,
  endpoint,
}) => {
  const failure = await withSettledPageWrites(
    page,
    /\/disconnect$/,
    async () => {
      await openWriter(page, endpoint, "POST", "/disconnect");
      const failed = page.waitForEvent("requestfailed", {
        predicate: (request) =>
          new URL(request.url()).pathname === "/disconnect",
      });
      await page.getByRole("button", { name: "Write", exact: true }).click();
      await failed;
    },
  ).catch((error: unknown) => error);

  expect(failure).toBeInstanceOf(AggregateError);
  expect(failure).toMatchObject({
    errors: [
      expect.objectContaining({
        message: expect.stringMatching(/socket hang up|ECONNRESET/),
      }),
    ],
  });
  expect(endpoint.writes).toEqual([
    { method: "POST", path: "/disconnect", body: "owned write" },
  ]);
  expect(page.isClosed()).toBe(true);
});

test("teardown rejects new writes and retains both body and cleanup errors", async ({
  page,
  endpoint,
}) => {
  const bodyFinished = gate();
  const bodyError = new Error("Intentional body failure");
  const failure = withSettledPageWrites(page, /\/(write|late)$/, async () => {
    await openWriter(page, endpoint);
    await page.getByRole("button", { name: "Write", exact: true }).click();
    await endpoint.received;
    bodyFinished.resolve();
    throw bodyError;
  }).catch((error: unknown) => error);

  await bodyFinished.promise;
  const failed = page.waitForEvent("requestfailed", {
    predicate: (request) => new URL(request.url()).pathname === "/late",
  });
  await page.getByRole("button", { name: "Write during teardown" }).click();
  await failed;
  endpoint.release();
  expect(await failure).toMatchObject({
    message: "Page write fixture and cleanup failed",
    errors: [
      bodyError,
      {
        message: "Page write request cleanup failed",
        errors: [{ message: "Page write started during fixture teardown" }],
      },
    ],
  });
  await endpoint.responded;
  expect(endpoint.writes).toEqual([
    { method: "POST", path: "/write", body: "owned write" },
  ]);
  expect(page.isClosed()).toBe(true);
});

test("response observer finishes before fulfillment and page teardown", async ({
  page,
  endpoint,
}) => {
  const observing = gate();
  const observed = gate();
  const bodyFinished = gate();
  const bodyError = new Error("Intentional body failure");
  const events: string[] = [];
  page.on("response", (response) => {
    if (new URL(response.url()).pathname === "/write")
      events.push("browser response");
  });
  page.on("close", () => events.push("close"));
  endpoint.release();
  const failure = withSettledPageWrites(
    page,
    /\/write$/,
    async () => {
      await openWriter(page, endpoint);
      await page.getByRole("button", { name: "Write", exact: true }).click();
      await observing.promise;
      bodyFinished.resolve();
      throw bodyError;
    },
    async (response, request) => {
      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual({});
      expect(request.method()).toBe("POST");
      expect(request.postData()).toBe("owned write");
      events.push("observer started");
      observing.resolve();
      await observed.promise;
      events.push("observer finished");
    },
  ).catch((error: unknown) => error);

  await bodyFinished.promise;
  try {
    // A real browser/server round trip gives teardown a chance to progress
    // while the observer is blocked. It must keep the page and response alive.
    expect(await page.evaluate(async () => (await fetch("/")).ok)).toBe(true);
    expect(events).toEqual(["observer started"]);
    expect(page.isClosed()).toBe(false);
  } finally {
    observed.resolve();
  }
  expect(await failure).toBe(bodyError);
  expect(events[0]).toBe("observer started");
  expect(events[1]).toBe("observer finished");
  expect(events.at(-1)).toBe("close");
  expect(endpoint.writes).toEqual([
    { method: "POST", path: "/write", body: "owned write" },
  ]);
});

test("observer failure aborts the browser write without replay and reports the error", async ({
  page,
  endpoint,
}) => {
  const observerError = new Error("Intentional observer failure");
  let observations = 0;
  endpoint.release();
  const failure = await withSettledPageWrites(
    page,
    /\/write$/,
    async () => {
      await openWriter(page, endpoint);
      const failed = page.waitForEvent("requestfailed", {
        predicate: (request) => new URL(request.url()).pathname === "/write",
      });
      await page.getByRole("button", { name: "Write", exact: true }).click();
      await failed;
    },
    async () => {
      observations += 1;
      throw observerError;
    },
  ).catch((error: unknown) => error);

  expect(failure).toMatchObject({
    message: "Page write request cleanup failed",
    errors: [observerError],
  });
  expect(observations).toBe(1);
  expect(endpoint.writes).toEqual([
    { method: "POST", path: "/write", body: "owned write" },
  ]);
  expect(page.isClosed()).toBe(true);
});

function workflowErrors(error: unknown): unknown[] {
  return error instanceof AggregateError
    ? error.errors.flatMap(workflowErrors)
    : [error];
}

test("normal browser workflow keeps its original body and write order", async ({
  page,
  endpoint,
}) => {
  const events: string[] = [];
  const browserReads: Promise<unknown>[] = [];
  endpoint.release();
  page.on("close", () => events.push("page closed"));
  try {
    await withBrowserWorkflow(page, async (workflow) => {
      await workflow.run(() =>
        withSettledPageWrites(
          page,
          /\/write$/,
          () =>
            workflow.body(async () => {
              await openWriter(page, endpoint);
              const response = page.waitForResponse(
                (response) => new URL(response.url()).pathname === "/write",
              );
              browserReads.push(response);
              void response.catch(() => undefined);
              await page
                .getByRole("button", { name: "Write", exact: true })
                .click();
              expect((await response).status()).toBe(200);
              events.push("body finished");
            }),
          async (response) => {
            expect(await response.json()).toEqual({});
            events.push("write observed");
          },
        ),
      );
    });
  } finally {
    await Promise.allSettled(browserReads);
  }
  expect(events).toEqual(["write observed", "body finished", "page closed"]);
  expect(endpoint.writes).toEqual([
    { method: "POST", path: "/write", body: "owned write" },
  ]);
});

for (const observerFails of [false, true]) {
  test(`interrupted body joins a submitted write, observer and actual callback (${observerFails ? "observer fails" : "observer succeeds"})`, async ({
    page,
    endpoint,
  }) => {
    const bodyWaiting = createDeferred();
    const finalizing = createDeferred();
    const observerEntered = createDeferred();
    const releaseObserver = createDeferred();
    const bodyRejected = createDeferred();
    const releaseBody = createDeferred();
    const useError = new Error("Fixture use ended during a write");
    const observerError = new Error("Original write observer failure");
    const events: string[] = [];
    const browserSignals: Promise<unknown>[] = [];
    let nativeBodyError: unknown;
    let publicRunError: unknown;
    let publicRunSettled = false;
    let settled = false;
    page.on("close", () => events.push("page closed"));
    const fixture = withBrowserWorkflow(page, async (workflow) => {
      const operation = workflow.run(() =>
        withSettledPageWrites(
          page,
          /\/(write|late)$/,
          async () => {
            try {
              await workflow.body(async () => {
                await openWriter(page, endpoint);
                await page
                  .getByRole("button", { name: "Write", exact: true })
                  .click();
                await endpoint.received;
                // This is the real Playwright wait. Fixture interruption must
                // enter write finalization before page closure rejects it.
                const response = page.waitForResponse(
                  (response) => new URL(response.url()).pathname === "/never",
                );
                bodyWaiting.resolve();
                try {
                  await response;
                } catch (error) {
                  nativeBodyError = error;
                  events.push("real callback rejected");
                  bodyRejected.resolve();
                  await releaseBody.promise;
                  events.push("real callback finished");
                  throw error;
                }
              });
            } finally {
              finalizing.resolve();
            }
          },
          async (response, request) => {
            expect(response.status()).toBe(200);
            expect(await response.json()).toEqual({});
            expect(request.postData()).toBe("owned write");
            events.push("observer entered");
            observerEntered.resolve();
            await releaseObserver.promise;
            events.push("observer finished");
            if (observerFails) throw observerError;
          },
        ),
      );
      void operation.then(
        () => {
          publicRunSettled = true;
        },
        (error: unknown) => {
          publicRunSettled = true;
          publicRunError = error;
        },
      );
      await Promise.race([
        bodyWaiting.promise,
        operation.then(() => {
          throw new Error("Workflow completed before the native body wait");
        }),
      ]);
      throw useError;
    }).then(
      () => {
        settled = true;
        return { error: undefined };
      },
      (error: unknown) => {
        settled = true;
        return { error };
      },
    );
    try {
      await finalizing.promise;
      // The endpoint already owns the submitted write, but has not responded.
      // A rejected late native request proves admission has actually closed.
      expect(endpoint.writes).toEqual([
        { method: "POST", path: "/write", body: "owned write" },
      ]);
      const lateFailed = page.waitForEvent("requestfailed", {
        predicate: (request) => new URL(request.url()).pathname === "/late",
      });
      browserSignals.push(lateFailed);
      void lateFailed.catch(() => undefined);
      await page.getByRole("button", { name: "Write during teardown" }).click();
      expect((await lateFailed).failure()?.errorText).toBe("net::ERR_ABORTED");
      expect(page.isClosed()).toBe(false);
      expect(settled).toBe(false);
      expect(events).toEqual([]);
      endpoint.release();
      await Promise.race([
        observerEntered.promise,
        bodyRejected.promise.then(() => {
          throw new Error("Page closed before the write observer entered");
        }),
      ]);
      // Even after the genuine response is available, observation still owns it.
      expect(await page.evaluate(async () => (await fetch("/")).ok)).toBe(true);
      expect(events).toEqual(["observer entered"]);
      expect(page.isClosed()).toBe(false);
      releaseObserver.resolve();
      await bodyRejected.promise;
      expect(page.isClosed()).toBe(true);
      expect(nativeBodyError).toBeInstanceOf(Error);
      expect(String(nativeBodyError)).toContain("closed");
      // A real HTTP round trip gives a dropped callback a chance to be exposed.
      // The context request client remains live after only the page closes.
      expect((await page.request.get(endpoint.origin)).status()).toBe(200);
      expect(settled).toBe(false);
      expect(publicRunSettled).toBe(false);
      releaseBody.resolve();
      const outcome = await fixture;
      expect(publicRunSettled).toBe(true);
      expect(workflowErrors(publicRunError)).toContain(nativeBodyError);
      const errors = workflowErrors(outcome.error);
      expect(errors).toContain(useError);
      expect(errors).toContain(nativeBodyError);
      expect(errors).toContainEqual(
        expect.objectContaining({
          message: "Browser workflow interrupted after fixture use ended",
        }),
      );
      if (observerFails) expect(errors).toContain(observerError);
      else expect(errors).not.toContain(observerError);
      expect(events).toEqual([
        "observer entered",
        "observer finished",
        "page closed",
        "real callback rejected",
        "real callback finished",
      ]);
      expect(endpoint.writes).toEqual([
        { method: "POST", path: "/write", body: "owned write" },
      ]);
    } finally {
      endpoint.release();
      releaseObserver.resolve();
      releaseBody.resolve();
      await fixture;
      await Promise.allSettled(browserSignals);
    }
  });
}

test("interruption during preparation does not start a late business callback", async ({
  page,
  endpoint,
}) => {
  const preparing = createDeferred();
  const releasePreparation = createDeferred();
  const useError = new Error("Fixture use ended during preparation");
  let bodyStarted = false;
  const fixture = withBrowserWorkflow(page, async (workflow) => {
    void workflow.run(async () => {
      preparing.resolve();
      await releasePreparation.promise;
      await withSettledPageWrites(page, /\/write$/, () =>
        workflow.body(async () => {
          bodyStarted = true;
          await openWriter(page, endpoint);
          await page
            .getByRole("button", { name: "Write", exact: true })
            .click();
        }),
      );
    });
    await preparing.promise;
    throw useError;
  }).catch((error: unknown) => error);
  try {
    await preparing.promise;
    expect((await page.goto(endpoint.origin))?.status()).toBe(200);
    releasePreparation.resolve();
    const errors = workflowErrors(await fixture);
    expect(errors).toContain(useError);
    expect(errors).toContainEqual(
      expect.objectContaining({
        message: "Browser workflow interrupted after fixture use ended",
      }),
    );
    expect(bodyStarted).toBe(false);
    expect(endpoint.writes).toEqual([]);
    expect(page.isClosed()).toBe(true);
  } finally {
    releasePreparation.resolve();
    endpoint.release();
    await fixture;
  }
});

for (const interrupted of [false, true]) {
  test(`pre-fetch PUT gate releases before drain after ${interrupted ? "fixture interruption" : "body failure"}`, async ({
    page,
    endpoint,
  }) => {
    const beforePut = createDeferred();
    const releasePut = createDeferred();
    const failBody = createDeferred();
    const bodyError = new Error("Original gated PUT body failure");
    const useError = new Error("Fixture use ended before PUT was sent");
    const events: string[] = [];
    let nativeBodyError: unknown;
    endpoint.release();
    page.on("close", () => events.push("page closed"));
    const failure = withBrowserWorkflow(page, async (workflow) => {
      const operation = workflow.run(() =>
        withSettledPageWrites(
          page,
          /\/write$/,
          async () => {
            try {
              await workflow.body(async () => {
                await openWriter(page, endpoint, "PUT");
                await page
                  .getByRole("button", { name: "Write", exact: true })
                  .click();
                await beforePut.promise;
                if (interrupted) {
                  try {
                    await page.waitForResponse(
                      (response) =>
                        new URL(response.url()).pathname === "/never",
                    );
                  } catch (error) {
                    nativeBodyError = error;
                    throw error;
                  }
                } else {
                  await failBody.promise;
                  throw bodyError;
                }
              });
            } finally {
              events.push("wrapper body ended");
              releasePut.resolve();
            }
          },
          async (response) => {
            expect(response.status()).toBe(200);
            events.push("write observed");
          },
          async (request) => {
            expect(request.method()).toBe("PUT");
            events.push("PUT gated");
            beforePut.resolve();
            await releasePut.promise;
            events.push("PUT released");
          },
        ),
      );
      await Promise.race([
        beforePut.promise,
        operation.then(() => {
          throw new Error("Workflow completed before the PUT gate");
        }),
      ]);
      // A real independent round trip confirms that the server is alive while
      // the original browser PUT remains held before route.fetch.
      expect((await page.request.get(endpoint.origin)).status()).toBe(200);
      expect(endpoint.writes).toEqual([]);
      expect(page.isClosed()).toBe(false);
      expect(events).toEqual(["PUT gated"]);
      if (interrupted) throw useError;
      failBody.resolve();
      await operation;
    }).catch((error: unknown) => error);
    let error: unknown;
    try {
      error = await failure;
    } finally {
      releasePut.resolve();
      failBody.resolve();
      await failure;
    }
    expect(events).toEqual([
      "PUT gated",
      "wrapper body ended",
      "PUT released",
      "write observed",
      "page closed",
    ]);
    expect(endpoint.writes).toEqual([
      { method: "PUT", path: "/write", body: "owned write" },
    ]);
    const errors = workflowErrors(error);
    if (interrupted) {
      expect(errors).toContain(useError);
      expect(nativeBodyError).toBeInstanceOf(Error);
      expect(String(nativeBodyError)).toContain("closed");
      expect(errors).toContain(nativeBodyError);
    } else {
      expect(errors).toEqual([bodyError]);
    }
    expect(page.isClosed()).toBe(true);
  });
}

test("pre-fetch failure aborts the paused browser write without sending it", async ({
  page,
  endpoint,
}) => {
  const hookError = new Error("Original pre-fetch failure");
  const failure = await withSettledPageWrites(
    page,
    /\/write$/,
    async () => {
      await openWriter(page, endpoint, "PUT");
      const failed = page.waitForEvent("requestfailed", {
        predicate: (request) => new URL(request.url()).pathname === "/write",
      });
      await page.getByRole("button", { name: "Write", exact: true }).click();
      expect((await failed).failure()?.errorText).toBe("net::ERR_ABORTED");
    },
    undefined,
    async () => {
      throw hookError;
    },
  ).catch((error: unknown) => error);
  expect(workflowErrors(failure)).toEqual([hookError]);
  expect(endpoint.writes).toEqual([]);
  expect(page.isClosed()).toBe(true);
});
