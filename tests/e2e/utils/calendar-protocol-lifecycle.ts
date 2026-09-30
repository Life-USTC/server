import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  type APIRequestContext,
  type APIResponse,
  type Request as BrowserRequest,
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
import { type HttpMcpRequest, ownHttpMcp } from "./http-mcp-lifecycle";
import type { IsolatedWorker } from "./isolated-worker";
import { withSettledPageWrites } from "./settled-page-writes";

export type CalendarBrowserWriteVerifier = (
  response: APIResponse,
  request: BrowserRequest,
) => Promise<void>;

export type CalendarProtocolChecks = {
  verifyTransport: (observation: CalendarProtocolObservation) => Promise<void>;
  verifyState: () => Promise<void>;
};
export type CalendarProtocolObservation = {
  effects: ProducerObservation;
  sdkRequests: HttpMcpRequest[];
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
    verifyBrowserWrite,
  }: {
    page: Page;
    observer: APIRequestContext;
    isolatedWorker: IsolatedWorker;
    createRequest: (
      headers: Record<string, string>,
    ) => Promise<APIRequestContext>;
    runBody: (body: () => Promise<void>) => Promise<void>;
    testInfo: TestInfo;
    verifyBrowserWrite?: CalendarBrowserWriteVerifier;
  },
  work: (io: CalendarProtocol) => Promise<CalendarProtocolChecks>,
) {
  const origin = isolatedWorker.origin;
  const secret = { "x-test-storage-secret": "local-test-storage-observer" };
  const probeId = crypto.randomUUID();
  const probePath = `/__test/community-effects?id=${probeId}`;
  const headers = { ...secret, "x-test-community-probe": probeId };
  const errors: unknown[] = [];
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
  let completed = false;
  const reads = ownBrowserReads(page, origin, () => !page.isClosed());
  const remember = (error: unknown) => {
    if (error instanceof AggregateError) {
      for (const child of error.errors) remember(child);
    } else if (!errors.includes(error)) errors.push(error);
  };
  const sdk = ownHttpMcp({ origin, headers, remember });
  const sdkRequests = sdk.requests;
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
                  return sdk.connect(identity, accessToken);
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
        if (new URL(incoming.url()).pathname !== "/oauth/authorize") {
          if (!verifyBrowserWrite)
            throw new Error(
              `Unexpected calendar browser write: ${incoming.method()} ${new URL(incoming.url()).pathname}`,
            );
          await verifyBrowserWrite(response, incoming);
          return;
        }
        const body = await response.text();
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
    await sdk.close(completed);
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
    await sdk.settle();
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
