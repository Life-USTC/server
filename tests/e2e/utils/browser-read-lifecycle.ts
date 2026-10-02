import type { Frame, Page, Request } from "@playwright/test";

/** Own browser observations through full-document replacement and page closure.
 * Server completion remains an independent responsibility of the caller. */
export function ownBrowserReads(
  page: Page,
  origin: string,
  accepting: () => boolean,
  { javaScriptEnabled = true }: { javaScriptEnabled?: boolean } = {},
) {
  const pendingReads = new Set<Promise<void>>();
  const readObservations = new Map<Request, Promise<void>>();
  type OwnedRead = {
    requestId: string;
    order: number;
    path: string;
    method: string;
    mainFrame: boolean;
    settled: boolean;
    status?: number;
    canceled?: true;
    retiredBy?: { order: number; url: string };
    closing?: boolean;
  };
  const pendingNavigations = new Set<Promise<void>>();
  const errors: unknown[] = [];
  const removing = new Set<Request>();
  const ownedReads = new Map<Request, OwnedRead>();
  const expectedCancellations = new Set<Request>();
  let stopped = false;
  function observeNavigation(incoming: Request, order: number) {
    // Register while the root request is admitted, before its response/commit.
    // A matching URL/framenavigated event alone can also be a same-document
    // navigation after a noncommitting 204/download and is not retirement proof.
    // Snapshot synchronously at the frame event, before destination scripts can
    // admit reads. The navigation response below must still verify this root;
    // the frame event alone never proves that a new document committed.
    let departingReads: OwnedRead[] | undefined;
    const captureBoundary = (frame: Frame) => {
      if (frame !== page.mainFrame() || departingReads) return;
      departingReads = [...ownedReads.entries()]
        .filter(
          ([request, owned]) =>
            owned.mainFrame &&
            (!request.isNavigationRequest() || owned.order < order),
        )
        .map(([, owned]) => owned);
    };
    page.on("framenavigated", captureBoundary);
    const observation = page.waitForNavigation({ waitUntil: "commit" }).then(
      (response) => {
        if (!response) return;
        let root = response.request();
        for (
          let predecessor = root.redirectedFrom();
          predecessor;
          predecessor = root.redirectedFrom()
        )
          root = predecessor;
        if (root !== incoming || !departingReads) return;
        const committed = { order, url: response.url() };
        for (const owned of departingReads)
          if (!owned.retiredBy) owned.retiredBy = committed;
      },
      () => undefined,
    );
    pendingNavigations.add(observation);
    void observation.finally(() => {
      page.off("framenavigated", captureBoundary);
      pendingNavigations.delete(observation);
    });
  }

  function observeRead(incoming: Request) {
    const predecessor = incoming.redirectedFrom();
    if (
      new URL(incoming.url()).origin !== origin ||
      !["GET", "HEAD"].includes(incoming.method()) ||
      (!accepting() && !(predecessor && ownedReads.has(predecessor)))
    )
      return;
    const requestId =
      (predecessor && ownedReads.get(predecessor)?.requestId) ||
      crypto.randomUUID();
    const order = ownedReads.size + 1;
    const path = new URL(incoming.url()).pathname;
    const owned: OwnedRead = {
      requestId,
      order,
      path,
      method: incoming.method(),
      mainFrame:
        !incoming.serviceWorker() && incoming.frame() === page.mainFrame(),
      settled: false,
    };
    ownedReads.set(incoming, owned);
    if (owned.mainFrame && incoming.isNavigationRequest() && !predecessor)
      observeNavigation(incoming, order);
    const operation = (async () => {
      try {
        const response = await incoming.response();
        if (!response) {
          // A component can cancel an obsolete read while its page stays open.
          // Cancellation is a native terminal, not a successful response. Required
          // results and UI state are asserted by the scenario that consumes them.
          if (incoming.failure()?.errorText === "net::ERR_ABORTED") {
            owned.canceled = true;
            return;
          }
          // Chromium reports module preloads as CSP-blocked when the caller
          // explicitly disables JavaScript. Preserve that browser outcome;
          // it is neither a successful HTTP response nor a server request.
          if (
            !javaScriptEnabled &&
            incoming.resourceType() === "script" &&
            incoming.failure()?.errorText === "csp"
          ) {
            return;
          }
          throw new Error(
            `Browser read failed: ${incoming.failure()?.errorText}`,
          );
        }
        owned.status = response.status();
        const location = response.headers().location;
        if (
          [301, 302, 303, 307, 308].includes(response.status()) &&
          location &&
          new URL(location, incoming.url()).origin === origin &&
          !incoming.redirectedTo()
        )
          await page.waitForEvent("request", {
            predicate: (next) => next.redirectedFrom() === incoming,
            timeout: 15_000,
          });
      } catch (error) {
        if (
          owned.closing &&
          owned.retiredBy &&
          page.isClosed() &&
          error instanceof Error &&
          error.message ===
            "request.response: Target page, context or browser has been closed"
        ) {
          owned.canceled = true;
        } else errors.push(error);
      } finally {
        owned.settled = true;
      }
    })();
    readObservations.set(incoming, operation);
    pendingReads.add(operation);
    void operation.finally(() => pendingReads.delete(operation));
  }

  function activeRead(request: Request) {
    const owned = ownedReads.get(request);
    return (
      !stopped &&
      !page.isClosed() &&
      owned?.mainFrame &&
      !request.isNavigationRequest() &&
      !owned.settled &&
      !request.failure() &&
      !expectedCancellations.has(request) &&
      !removing.has(request)
    );
  }

  async function duringRemoval(
    requests: readonly Request[],
    action: () => Promise<void>,
  ) {
    if (
      new Set(requests).size !== requests.length ||
      requests.some((request) => !activeRead(request))
    )
      throw new Error(
        "Removal requires distinct active owned reads before the action",
      );
    for (const request of requests) removing.add(request);
    try {
      await action();
      await Promise.all(
        requests.map((request) => readObservations.get(request)),
      );
      if (page.isClosed() || stopped)
        throw new Error(
          "Removal action closed its page or stopped its observer",
        );
      for (const request of requests) {
        const owned = ownedReads.get(request);
        if (!owned?.settled || (owned.status === undefined && !owned.canceled))
          throw new Error(
            `Component removal read failed: ${request.failure()?.errorText ?? "no native response"}`,
          );
      }
    } catch (error) {
      errors.push(error);
      throw error;
    } finally {
      for (const request of requests) removing.delete(request);
    }
  }

  return {
    ownedReads,
    duringRemoval,
    activeReads: () => [...ownedReads.keys()].filter(activeRead),
    errors,
    pendingReads,
    pendingNavigations,
    start() {
      page.on("request", observeRead);
    },
    expectCancellation(request: Request) {
      const owned = ownedReads.get(request);
      if (
        stopped ||
        !owned ||
        owned.settled ||
        request.failure() ||
        expectedCancellations.has(request) ||
        removing.has(request)
      )
        throw new Error(
          "Cancellation must be declared for an active owned Request before it fails",
        );
      expectedCancellations.add(request);
    },
    prepareRetiredClose() {
      const unsettled = [...ownedReads.values()].filter(
        (owned) => !owned.settled,
      );
      if (unsettled.some((owned) => !owned.retiredBy))
        throw new Error("An active document read has no browser terminal");
      for (const owned of unsettled) owned.closing = true;
    },
    stop() {
      if (stopped) return;
      stopped = true;
      page.off("request", observeRead);
      for (const request of expectedCancellations) {
        const owned = ownedReads.get(request);
        if (
          !owned?.settled ||
          !owned.canceled ||
          request.failure()?.errorText !== "net::ERR_ABORTED"
        )
          errors.push(
            new Error(
              `Expected cancellation did not receive native requestfailed net::ERR_ABORTED: ${owned?.requestId} ${owned?.method} ${owned?.path}`,
            ),
          );
      }
    },
  };
}
