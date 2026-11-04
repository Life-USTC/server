import { once } from "node:events";
import {
  createServer,
  type Server as HttpServer,
  type RequestListener,
} from "node:http";
import { connect, type Socket } from "node:net";
import { test as base, expect } from "@playwright/test";
import { SocksClient } from "socks";
import { createDeferred } from "../../../../shared/deferred";
import { withSettledPageWrites } from "../../../utils/settled-page-writes";
import {
  ownWorkerTransport,
  withWorkerTransport,
} from "../../../utils/worker-transport";

type Entry = {
  method: string;
  path: string;
  host: string;
  cookie: string;
  body: string;
};
type Endpoint = {
  origin: string;
  otherOrigin: string;
  entries: Entry[];
  expires: number;
  held: ReturnType<typeof createDeferred<Socket>>;
};
async function listen(server: HttpServer) {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No endpoint port");
  return address.port;
}
const test = base.extend<{ endpoint: Endpoint }>({
  proxy: async ({ endpoint }, use) => {
    await withWorkerTransport(endpoint.origin, use);
  },
  // biome-ignore lint/correctness/noEmptyPattern: native fixture dependencies.
  endpoint: async ({}, use) => {
    const entries: Entry[] = [];
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const held = createDeferred<Socket>();
    const sockets = new Set<Socket>();
    let otherOrigin = "";
    const handler: RequestListener = (request, response) => {
      const url = new URL(request.url ?? "/", "http://unused");
      if (url.pathname === "/partial") held.resolve(request.socket);
      request.on("error", () => {});
      let body = "";
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => {
        const entry = {
          method: request.method ?? "",
          path: url.pathname,
          host: request.headers.host ?? "",
          cookie: request.headers.cookie ?? "",
          body,
        };
        entries.push(entry);
        if (url.pathname === "/hold") {
          held.resolve(request.socket);
          return;
        }
        if (url.pathname.startsWith("/redirect/")) {
          response.writeHead(Number(url.pathname.split("/").at(-1)), {
            location: url.searchParams.has("cross")
              ? `${otherOrigin}/finish`
              : "/finish",
            "set-cookie": "hop=redirect; Path=/; HttpOnly; SameSite=Lax",
          });
          response.end();
          return;
        }
        if (url.pathname === "/cookies")
          response.setHeader("set-cookie", [
            "hostOnly=one; Path=/; HttpOnly; SameSite=Lax",
            `domainCookie=two; Domain=localhost; Path=/; Expires=${new Date(expires * 1000).toUTCString()}; SameSite=Lax`,
            "pathCookie=three; Path=/scoped; SameSite=Lax",
            "expired=gone; Path=/; Max-Age=0",
            "rejected=bad; Domain=unrelated.invalid; Path=/",
          ]);
        if (url.pathname === "/large") {
          const data = Buffer.alloc(1024 * 1024, 171);
          data[data.length - 1] = 23;
          response.setHeader("content-type", "application/octet-stream");
          response.setHeader("connection", "close");
          response.end(data);
          return;
        }
        if (url.pathname === "/") {
          response.setHeader("content-type", "text/html");
          response.end("<main>Native transport endpoint</main>");
        } else {
          response.setHeader("content-type", "application/json");
          response.end(JSON.stringify(entry));
        }
      });
    };
    const servers = [createServer(handler), createServer(handler)];
    for (const server of servers)
      server.on("connection", (socket) => {
        sockets.add(socket);
        socket.on("error", () => {});
        socket.on("close", () => sockets.delete(socket));
      });
    try {
      const port = await listen(servers[0]);
      const otherPort = await listen(servers[1]);
      otherOrigin = `http://127.0.0.1:${otherPort}`;
      await use({
        origin: `http://localhost:${port}`,
        otherOrigin,
        entries,
        expires,
        held,
      });
    } finally {
      const closed = [...sockets].map((socket) => {
        const promise = new Promise<void>((resolve) =>
          socket.once("close", resolve),
        );
        socket.destroy();
        return promise;
      });
      await Promise.all([
        ...closed,
        ...servers
          .filter((s) => s.listening)
          .map(
            (s) =>
              new Promise<void>((resolve, reject) =>
                s.close((e) => (e ? reject(e) : resolve())),
              ),
          ),
      ]);
    }
  },
});

test("HTTP navigation and API requests preserve Host, original origin and non-owned authority", {
  tag: "@Infrastructure/Runtime",
}, async ({ page, endpoint }) => {
  await page.goto(endpoint.origin);
  expect(await page.locator("main").textContent()).toBe(
    "Native transport endpoint",
  );
  expect(new URL(page.url()).origin).toBe(endpoint.origin);
  expect(endpoint.entries[0].host).toBe(new URL(endpoint.origin).host);
  const alternate = new URL(endpoint.otherOrigin);
  alternate.hostname = "localhost";
  for (const origin of [alternate.origin, endpoint.otherOrigin]) {
    const response = await page.request.get(`${origin}/echo`);
    expect(response.url()).toBe(`${origin}/echo`);
    expect((await response.json()).host).toBe(new URL(origin).host);
    await page.goto(`${origin}/echo`);
    expect(JSON.parse(await page.locator("body").innerText()).host).toBe(
      new URL(origin).host,
    );
  }
});

test("browser-managed request and multiple response cookies retain domain path and expiry", {
  tag: "@Infrastructure/Runtime",
}, async ({ page, context, endpoint }) => {
  await context.addCookies([
    {
      name: "session",
      value: "original",
      url: endpoint.origin,
      httpOnly: true,
    },
    { name: "expired", value: "old", url: endpoint.origin },
  ]);
  await page.goto(endpoint.origin);
  let observations = 0;
  await withSettledPageWrites(
    page,
    "**/cookies",
    async () => {
      const body = await page.evaluate(async () =>
        (
          await fetch("/cookies", { method: "POST", body: "exact write" })
        ).json(),
      );
      expect(body).toMatchObject({
        method: "POST",
        body: "exact write",
        host: new URL(endpoint.origin).host,
      });
      expect(body.cookie).toContain("session=original");
      for (const path of ["/echo", "/scoped/echo"]) {
        const echo = await page.evaluate(
          async (path) => (await fetch(path)).json(),
          path,
        );
        expect(echo.cookie).toContain("hostOnly=one");
        expect(echo.cookie).toContain("domainCookie=two");
        expect(echo.cookie.includes("pathCookie=three")).toBe(
          path.startsWith("/scoped/"),
        );
        expect(echo.cookie).not.toContain("expired=");
        expect(echo.cookie).not.toContain("rejected=");
      }
    },
    async (response, request) => {
      observations++;
      expect(response.url()).toBe(`${endpoint.origin}/cookies`);
      expect(await request.headerValue("cookie")).toContain("session=original");
      expect(
        response
          .headersArray()
          .filter((h) => h.name.toLowerCase() === "set-cookie"),
      ).toHaveLength(5);
      const cookies = await context.cookies();
      expect(cookies.find((c) => c.name === "hostOnly")).toMatchObject({
        domain: "localhost",
        path: "/",
        httpOnly: true,
      });
      expect(cookies.find((c) => c.name === "domainCookie")?.expires).toBe(
        endpoint.expires,
      );
      expect(cookies.find((c) => c.name === "pathCookie")?.path).toBe(
        "/scoped",
      );
      expect(
        cookies.some((c) => ["expired", "rejected"].includes(c.name)),
      ).toBe(false);
      expect(await context.cookies(endpoint.otherOrigin)).toEqual([]);
    },
  );
  expect(observations).toBe(1);
  expect(endpoint.entries.filter((e) => e.method === "POST")).toHaveLength(1);
});

for (const status of [302, 303, 307])
  for (const cross of [false, true]) {
    test(`redirect ${status} preserves method/body and ${cross ? "cross-origin" : "same-origin"} cookies`, {
      tag: "@Infrastructure/Runtime",
    }, async ({ page, context, endpoint }) => {
      await context.addCookies([
        { name: "session", value: "source", url: endpoint.origin },
        { name: "destination", value: "target", url: endpoint.otherOrigin },
      ]);
      await page.goto(endpoint.origin);
      let observations = 0;
      await withSettledPageWrites(
        page,
        "**/redirect/**",
        async () => {
          await page.evaluate(
            (action) => {
              const form = document.createElement("form");
              form.method = "POST";
              form.action = action;
              const input = document.createElement("input");
              input.name = "payload";
              input.value = "owned write";
              form.append(input);
              const button = document.createElement("button");
              button.textContent = "Submit";
              form.append(button);
              document.body.append(form);
            },
            `/redirect/${status}${cross ? "?cross=1" : ""}`,
          );
          await Promise.all([
            page.waitForURL("**/finish"),
            page.getByRole("button", { name: "Submit" }).click(),
          ]);
          const final = JSON.parse(
            await page.locator("body").innerText(),
          ) as Entry;
          expect(final.method).toBe(status === 307 ? "POST" : "GET");
          expect(final.body).toBe(status === 307 ? "payload=owned+write" : "");
          expect(final.host).toBe(
            new URL(cross ? endpoint.otherOrigin : endpoint.origin).host,
          );
          if (cross) {
            expect(final.cookie).toContain("destination=target");
            expect(final.cookie).not.toMatch(/session=|hop=/);
          } else {
            expect(final.cookie).toContain("session=source");
            expect(final.cookie).toContain("hop=redirect");
          }
        },
        async (response) => {
          observations++;
          expect(response.status()).toBe(status);
          expect(endpoint.entries.some((e) => e.path === "/finish")).toBe(
            false,
          );
        },
      );
      expect(observations).toBe(1);
      expect(
        endpoint.entries
          .filter(
            (e) => e.path.startsWith("/redirect/") || e.path === "/finish",
          )
          .map((e) => [e.path, e.method, e.body]),
      ).toEqual([
        [`/redirect/${status}`, "POST", "payload=owned+write"],
        [
          "/finish",
          status === 307 ? "POST" : "GET",
          status === 307 ? "payload=owned+write" : "",
        ],
      ]);
    });
  }

test("native cancellation closes an in-flight tunneled write without replay", {
  tag: "@Infrastructure/Runtime",
}, async ({ page, endpoint }) => {
  const abort = new AbortController();
  const pending = page.request
    .post(`${endpoint.origin}/hold`, {
      data: "one write",
      signal: abort.signal,
    })
    .catch((error) => error);
  const socket = await endpoint.held.promise;
  const closed = new Promise<void>((resolve) => socket.once("close", resolve));
  abort.abort(new Error("cancel owned request"));
  expect(await pending).toBeInstanceOf(Error);
  await closed;
  expect(endpoint.entries.filter((e) => e.path === "/hold")).toHaveLength(1);
});

test("browser page close cancels ordinary HTTP without a second request", {
  tag: "@Infrastructure/Runtime",
}, async ({ page, endpoint }) => {
  const pending = page.goto(`${endpoint.origin}/hold`).catch((error) => error);
  const socket = await endpoint.held.promise;
  const closed = new Promise<void>((resolve) => socket.once("close", resolve));
  await page.close();
  expect(await pending).toBeInstanceOf(Error);
  await closed;
  expect(endpoint.entries.filter((e) => e.path === "/hold")).toHaveLength(1);
});

async function expectRefused(address: string) {
  const url = new URL(address);
  const socket = connect({ host: url.hostname, port: Number(url.port) });
  const [error] = await once(socket, "error");
  expect(error.code).toBe("ECONNREFUSED");
}

test("disposal during native listener startup joins binding and forbids restart", {
  tag: "@Infrastructure/Runtime",
}, async ({ endpoint }) => {
  const owner = ownWorkerTransport(endpoint.origin);
  const starting = owner.start().catch((error) => error);
  const closing = owner.dispose();
  expect(await starting).toMatchObject({
    message: "Owned Worker transport disposed",
  });
  await closing;
  expect(owner.dispose()).toBe(closing);
  expect(owner.state()).toMatchObject({
    listening: false,
    connections: 0,
    closing: true,
  });
  expect(await owner.start().catch((error) => error)).toMatchObject({
    message: "Owned Worker transport disposed",
  });
  const address = owner.state().address;
  if (!address) throw new Error("Listener never bound");
  await expectRefused(address);
});

test("body failure after acquisition closes listener and preserves original failure", {
  tag: "@Infrastructure/Runtime",
}, async ({ endpoint }) => {
  let address = "";
  const failure = new Error("context creation failed");
  expect(
    await withWorkerTransport(endpoint.origin, async (proxy) => {
      address = proxy.server;
      throw failure;
    }).catch((error) => error),
  ).toBe(failure);
  await expectRefused(address);
});

test("transport teardown resets a partial tunneled body and joins source sockets", {
  tag: "@Infrastructure/Runtime",
}, async ({ endpoint }) => {
  const owner = ownWorkerTransport(endpoint.origin);
  const proxy = await owner.start();
  const url = new URL(proxy.server);
  const { socket: client } = await SocksClient.createConnection({
    command: "connect",
    proxy: { host: url.hostname, port: Number(url.port), type: 5 },
    destination: {
      host: "localhost",
      port: Number(new URL(endpoint.origin).port),
    },
  });
  client.on("error", () => {});
  try {
    client.write(
      `POST /partial HTTP/1.1\r\nHost: ${new URL(endpoint.origin).host}\r\nContent-Length: 999\r\n\r\npartial`,
    );
    const upstream = await endpoint.held.promise;
    expect(owner.state().connections).toBe(2);
    const upstreamClosed = new Promise<void>((resolve) =>
      upstream.once("close", resolve),
    );
    const clientClosed = new Promise<void>((resolve) =>
      client.once("close", resolve),
    );
    client.resume();
    await owner.dispose();
    await Promise.all([upstreamClosed, clientClosed]);
    expect(owner.state()).toMatchObject({ connections: 0, listening: false });
    expect(endpoint.entries).toEqual([]);
    await expectRefused(proxy.server);
  } finally {
    client.destroy();
    await owner.dispose();
  }
});

test("clean upstream EOF flushes a large binary response", {
  tag: "@Infrastructure/Runtime",
}, async ({ page, endpoint }) => {
  await page.goto(endpoint.origin);
  const data = await page.evaluate(async () => {
    const bytes = new Uint8Array(await (await fetch("/large")).arrayBuffer());
    return {
      length: bytes.length,
      first: bytes[0],
      last: bytes.at(-1),
      sum: bytes.reduce((sum, byte) => sum + byte, 0),
    };
  });
  expect(data).toEqual({
    length: 1024 * 1024,
    first: 171,
    last: 23,
    sum: 171 * (1024 * 1024 - 1) + 23,
  });
});

test("teardown owns a partial SOCKS handshake before any target exists", {
  tag: "@Infrastructure/Runtime",
}, async ({ endpoint }) => {
  const owner = ownWorkerTransport(endpoint.origin);
  const proxy = new URL((await owner.start()).server);
  const client = connect({ host: proxy.hostname, port: Number(proxy.port) });
  client.on("error", () => {});
  try {
    await once(client, "connect");
    client.write(Buffer.from([5]));
    await expect.poll(() => owner.state().connections).toBe(1);
    const closed = new Promise<void>((resolve) =>
      client.once("close", resolve),
    );
    await owner.dispose();
    expect(owner.state()).toMatchObject({ connections: 0, listening: false });
    await closed;
    expect(endpoint.entries).toEqual([]);
  } finally {
    client.destroy();
    await owner.dispose();
  }
});
