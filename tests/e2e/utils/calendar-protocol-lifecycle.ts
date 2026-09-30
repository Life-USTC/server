import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  type APIRequestContext,
  expect,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { ownBrowserReads } from "./browser-read-lifecycle";
import {
  type CalendarMessage,
  type CalendarObservation,
  createCalendarEffectObserver,
  type ProducerObservation,
} from "./calendar-effects";
import type { IsolatedWorker } from "./isolated-worker";
import { withSettledPageWrites } from "./settled-page-writes";

export type CalendarProtocolChecks = {
  verifyTransport: (observation: CalendarProtocolObservation) => Promise<void>;
  verifyState: () => Promise<void>;
};
export type CalendarProtocolObservation = {
  effects: ProducerObservation;
  sdkRequests: SdkRequest[];
};
export type CalendarProtocol = {
  request: APIRequestContext;
  observeCalendar: (
    account: { id: string },
    messages: CalendarMessage[],
  ) => Promise<void>;
  mcp: (
    identity: { name: string; version: string },
    accessToken: string,
  ) => Promise<Client>;
};
type SdkRequest = {
  requestId: string;
  method: string;
  path: string;
  rpc?: string;
  tool?: string;
  status: number;
};

/** Calendar protocol lifecycle with real browser OAuth consent. The
 * scenario supplies its independent post-drain grant/usage/state assertions. */
export async function withCalendarProtocol(
  {
    page,
    observer,
    isolatedWorker,
    createRequest,
    runBody,
    testInfo,
  }: {
    page: Page;
    observer: APIRequestContext;
    isolatedWorker: IsolatedWorker;
    createRequest: (
      headers: Record<string, string>,
    ) => Promise<APIRequestContext>;
    runBody: (body: () => Promise<void>) => Promise<void>;
    testInfo: TestInfo;
  },
  work: (io: CalendarProtocol) => Promise<CalendarProtocolChecks>,
) {
  const origin = isolatedWorker.origin;
  const secret = { "x-test-storage-secret": "local-test-storage-observer" };
  const probeId = crypto.randomUUID();
  const probePath = `/__test/community-effects?id=${probeId}`;
  const headers = { ...secret, "x-test-community-probe": probeId };
  const pendingSdk = new Set<Promise<void>>();
  const sdkRequests: SdkRequest[] = [];
  const clients: (() => Promise<void>)[] = [];
  const errors: unknown[] = [];
  const abort = new AbortController();
  let request: APIRequestContext | undefined;
  let actualBody: Promise<void> | undefined;
  let checks: CalendarProtocolChecks | undefined;
  let observation: CalendarProtocolObservation | undefined;
  let calendar:
    | {
        observer: ReturnType<typeof createCalendarEffectObserver>;
        messages: CalendarMessage[];
      }
    | undefined;
  let registrationAttempted = false;
  let registered = false;
  let accepting = true;
  let sdkClosed = false;
  let completed = false;
  const reads = ownBrowserReads(page, origin, () => !page.isClosed());
  const remember = (error: unknown) => {
    if (error instanceof AggregateError) {
      for (const child of error.errors) remember(child);
    } else if (!errors.includes(error)) errors.push(error);
  };
  const settleSdk = async () => {
    while (pendingSdk.size) await Promise.all([...pendingSdk]);
  };
  const sdkFetch: typeof fetch = (input, init) => {
    const operation = Promise.resolve().then(async () => {
      if (sdkClosed) throw new Error("Calendar MCP transport is closed");
      const incoming = new Request(input, init);
      const url = new URL(incoming.url);
      expect(url.origin).toBe(origin);
      expect(url.pathname).toBe("/api/mcp");
      const payload =
        incoming.method === "POST"
          ? ((await incoming.clone().json()) as {
              method: string;
              params?: { name?: string };
            })
          : undefined;
      expect(
        incoming.method === "GET" ||
          (incoming.method === "POST" &&
            ["initialize", "notifications/initialized", "tools/call"].includes(
              payload?.method ?? "",
            )),
      ).toBe(true);
      const expectedStatus =
        incoming.method === "GET"
          ? 405
          : payload?.method === "notifications/initialized"
            ? 202
            : 200;
      const requestId = crypto.randomUUID();
      sdkRequests.push({
        requestId,
        method: incoming.method,
        path: url.pathname,
        rpc: payload?.method,
        tool: payload?.params?.name,
        status: expectedStatus,
      });
      const tagged = new Headers(incoming.headers);
      for (const [name, value] of Object.entries(headers))
        tagged.set(name, value);
      tagged.set("x-test-community-request", requestId);
      const response = await fetch(
        new Request(incoming, {
          headers: tagged,
          signal: AbortSignal.any([incoming.signal, abort.signal]),
        }),
      );
      // Current stateless MCP replies are finite. Join genuine response bytes
      // through EOF before letting the SDK parse the same body and headers.
      const body = response.body ? await response.arrayBuffer() : null;
      expect(response.status).toBe(expectedStatus);
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    });
    const settled = operation.then(() => undefined, remember);
    pendingSdk.add(settled);
    void settled.finally(() => pendingSdk.delete(settled));
    return operation;
  };
  try {
    registrationAttempted = true;
    const registration = await observer.post(probePath, { headers: secret });
    registered = registration.status() === 201;
    await registration.body();
    expect(registration.status()).toBe(201);
    // Context headers also apply to its already-created page.request client.
    await page.context().setExtraHTTPHeaders(headers);
    request = await createRequest(headers);
    const anonymous = request;
    reads.start();
    await withSettledPageWrites(
      page,
      (url) => url.origin === origin,
      async () => {
        try {
          await runBody(() => {
            actualBody = Promise.resolve().then(async () => {
              checks = await work({
                request: anonymous,
                async observeCalendar(account, messages) {
                  if (!accepting || calendar)
                    throw new Error(
                      "Calendar consumer is already owned or closing",
                    );
                  // Retain the observer before registration can fail or be
                  // interrupted. The successful plan never follows actual sends.
                  calendar = {
                    observer: createCalendarEffectObserver({
                      request: observer,
                      producerPath: probePath,
                      account,
                    }),
                    messages: structuredClone(messages),
                  };
                  await calendar.observer.register();
                },
                async mcp(identity, accessToken) {
                  if (!accepting)
                    throw new Error("Calendar workflow is closing");
                  const client = new Client(identity);
                  const transport = new StreamableHTTPClientTransport(
                    new URL("/api/mcp", origin),
                    {
                      requestInit: {
                        headers: { Authorization: `Bearer ${accessToken}` },
                      },
                      fetch: sdkFetch,
                    },
                  );
                  let closed: Promise<void> | undefined;
                  // Register close before connect can start its handshake/stream.
                  clients.push(() => (closed ??= client.close()));
                  await client.connect(transport);
                  return client;
                },
              });
              completed = true;
            });
            return actualBody;
          });
        } finally {
          accepting = false;
          try {
            await expect
              .poll(
                () =>
                  [...reads.ownedReads.values()].filter(
                    (read) => !read.settled && !read.retiredBy,
                  ).length,
                { timeout: 15_000 },
              )
              .toBe(0);
            reads.prepareRetiredClose();
          } catch (error) {
            remember(error);
          }
        }
      },
      async (response, incoming) => {
        const body = await response.text();
        expect(new URL(incoming.url()).pathname).toBe("/oauth/authorize");
        expect(incoming.method()).toBe("POST");
        expect(response.status()).toBe(200);
        expect(JSON.parse(body)).toMatchObject({
          type: "redirect",
          status: 303,
        });
      },
    );
  } catch (error) {
    remember(error);
  } finally {
    accepting = false;
    // Normally join finite fetches before closing; interruption must first abort
    // the SDK so a pending call can release the still-owned callback.
    if (completed) {
      try {
        await expect.poll(() => pendingSdk.size, { timeout: 15_000 }).toBe(0);
      } catch (error) {
        remember(error);
      }
    }
    for (const close of clients) {
      try {
        await close();
      } catch (error) {
        remember(error);
      }
    }
    sdkClosed = true;
    abort.abort(new Error("Calendar protocol transport disposed"));
    await settleSdk();
    if (!page.isClosed()) {
      try {
        await page.close();
      } catch (error) {
        remember(error);
      }
    }
    // Retain API response storage and the private DB while a callback interrupted
    // by page/SDK closure completes its remaining reads or finally work.
    if (actualBody) {
      try {
        await actualBody;
      } catch (error) {
        remember(error);
      }
    }
    await settleSdk();
    while (reads.pendingReads.size || reads.pendingNavigations.size)
      await Promise.allSettled([
        ...reads.pendingReads,
        ...reads.pendingNavigations,
      ]);
    reads.stop();
    for (const error of reads.errors) remember(error);
    try {
      await request?.dispose();
    } catch (error) {
      remember(error);
    }
    if (registered) {
      try {
        let effects: ProducerObservation;
        let consumer: CalendarObservation | undefined;
        if (calendar) {
          ({ producer: effects, consumer } = await calendar.observer.collect(
            completed ? calendar.messages.length : "submitted",
          ));
        } else {
          const response = await observer.get(probePath, { headers: secret });
          await response.body();
          expect(response.status()).toBe(200);
          effects = await response.json();
        }
        observation = { effects, sdkRequests };
        await testInfo.attach("calendar-protocol-effects", {
          contentType: "application/json",
          body: JSON.stringify({
            effects,
            consumer,
            sdkRequests,
            browserReads: reads.reads,
          }),
        });
        if (calendar && consumer)
          calendar.observer.assert(
            { producer: effects, consumer },
            calendar.messages,
            completed,
          );
        else {
          // No actor was registered: setup cannot have admitted a queue write.
          expect(effects.messages).toEqual([]);
        }
        expect(effects.backgroundErrors).toEqual([]);
        expect(effects.purges).toEqual([]);
        for (const native of effects.requests) {
          expect(native.outcome).toBe("fulfilled");
          expect(native.result).toEqual(expect.any(Number));
        }
        for (const read of sdkRequests) {
          const producers = effects.requests.filter(
            (native: { value: { requestId?: string } }) =>
              native.value.requestId === read.requestId,
          );
          expect(producers).toEqual([
            {
              outcome: "fulfilled",
              value: {
                requestId: read.requestId,
                method: read.method,
                path: read.path,
              },
              result: read.status,
            },
          ]);
        }
      } catch (error) {
        remember(error);
      }
    }
    if (registrationAttempted) {
      // DELETE drains again if registration's response or GET/observation failed.
      // It must finish before independent grant, usage and state observations.
      try {
        const response = await observer.delete(probePath, { headers: secret });
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
          await checks.verifyTransport(observation);
        } catch (error) {
          remember(error);
        }
      }
      // State observations are independent of transport/evidence failures.
      try {
        await checks.verifyState();
      } catch (error) {
        remember(error);
      }
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length)
    throw new AggregateError(errors, "Calendar protocol workflow failed");
}
