import type { Request } from "@playwright/test";
import { test as navigationTest } from "./navigation-policy-fixture";

/** Temporary observation only: no Fetch interception or response-body reads. */
export const test = navigationTest.extend<{ _networkDiagnostic: undefined }>({
  _networkDiagnostic: [
    async ({ page }, use, testInfo) => {
      const events: Record<string, string | number | boolean>[] = [];
      const cdpRequests = new Map<string, string>();
      const browserRequests = new Map<Request, number>();
      const pathOf = (url: string) => {
        const path = new URL(url).pathname;
        if (path === "/workspace/subscriptions/activities/__data.json")
          return path;
        if (/^\/api\/workspace\/young-notifications\/[^/]+\/read$/.test(path))
          return "/api/workspace/young-notifications/:id/read";
        return undefined;
      };
      const record = (
        event: string,
        details: Record<string, string | number | boolean>,
      ) => {
        events.push({ event, observedAt: performance.now(), ...details });
      };
      const browserRequest = (request: Request) => {
        const path = pathOf(request.url());
        if (!path) return;
        const id = browserRequests.size + 1;
        browserRequests.set(request, id);
        record("playwright.request", { id, path, method: request.method() });
      };
      const browserFinished = (request: Request) => {
        const id = browserRequests.get(request);
        if (id !== undefined) record("playwright.requestfinished", { id });
      };
      const browserFailed = (request: Request) => {
        const id = browserRequests.get(request);
        if (id !== undefined) record("playwright.requestfailed", { id });
      };
      const listeners: (() => void)[] = [];
      const cdp = await page.context().newCDPSession(page);
      try {
        page.on("request", browserRequest);
        page.on("requestfinished", browserFinished);
        page.on("requestfailed", browserFailed);
        const requestWillBeSent: Parameters<
          typeof cdp.on<"Network.requestWillBeSent">
        >[1] = (event) => {
          const path = pathOf(event.request.url);
          if (!path) return;
          cdpRequests.set(event.requestId, path);
          record("cdp.requestWillBeSent", {
            id: event.requestId,
            path,
            method: event.request.method,
            timestamp: event.timestamp,
          });
        };
        cdp.on("Network.requestWillBeSent", requestWillBeSent);
        listeners.push(() =>
          cdp.off("Network.requestWillBeSent", requestWillBeSent),
        );
        const responseReceived: Parameters<
          typeof cdp.on<"Network.responseReceived">
        >[1] = (event) => {
          if (!cdpRequests.has(event.requestId)) return;
          record("cdp.responseReceived", {
            id: event.requestId,
            status: event.response.status,
            timestamp: event.timestamp,
          });
        };
        cdp.on("Network.responseReceived", responseReceived);
        listeners.push(() =>
          cdp.off("Network.responseReceived", responseReceived),
        );
        const dataReceived: Parameters<
          typeof cdp.on<"Network.dataReceived">
        >[1] = (event) => {
          if (!cdpRequests.has(event.requestId)) return;
          record("cdp.dataReceived", {
            id: event.requestId,
            dataLength: event.dataLength,
            encodedDataLength: event.encodedDataLength,
            timestamp: event.timestamp,
          });
        };
        cdp.on("Network.dataReceived", dataReceived);
        listeners.push(() => cdp.off("Network.dataReceived", dataReceived));
        const loadingFinished: Parameters<
          typeof cdp.on<"Network.loadingFinished">
        >[1] = (event) => {
          if (!cdpRequests.has(event.requestId)) return;
          record("cdp.loadingFinished", {
            id: event.requestId,
            encodedDataLength: event.encodedDataLength,
            timestamp: event.timestamp,
          });
        };
        cdp.on("Network.loadingFinished", loadingFinished);
        listeners.push(() =>
          cdp.off("Network.loadingFinished", loadingFinished),
        );
        const loadingFailed: Parameters<
          typeof cdp.on<"Network.loadingFailed">
        >[1] = (event) => {
          if (!cdpRequests.has(event.requestId)) return;
          record("cdp.loadingFailed", {
            id: event.requestId,
            timestamp: event.timestamp,
            canceled: event.canceled ?? false,
          });
        };
        cdp.on("Network.loadingFailed", loadingFailed);
        listeners.push(() => cdp.off("Network.loadingFailed", loadingFailed));
        await cdp.send("Network.enable");
        await use(undefined);
      } finally {
        page.off("request", browserRequest);
        page.off("requestfinished", browserFinished);
        page.off("requestfailed", browserFailed);
        for (const remove of listeners) remove();
        try {
          await cdp.detach();
          record("cdp.detached", { pageClosed: page.isClosed() });
        } catch {
          // Closing the page normally detaches its CDP sessions first.
          record("cdp.detach-rejected", { pageClosed: page.isClosed() });
        }
        await testInfo.attach("navigation-network-diagnostic", {
          contentType: "application/json",
          body: JSON.stringify({ events }),
        });
      }
    },
    { auto: true },
  ],
});
