import { createServer } from "node:http";
import { test as base, expect, type Page } from "@playwright/test";
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
