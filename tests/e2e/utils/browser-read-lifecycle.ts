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
    canceled?: "retired" | "removed" | "superseded";
    retiredBy?: { order: number; url: string };
    closing?: boolean;
  };
  const pendingNavigations = new Set<Promise<void>>();
  const pendingNavigationOrders = new Map<number, Promise<void>>();
  const errors: unknown[] = [];
  const removals = new Map<
    Request,
    {
      responseMissing: boolean;
      failureObserved: boolean;
      nativeFailure?: string;
      failure: Promise<void>;
      wake: () => void;
    }
  >();
  const ownedReads = new Map<Request, OwnedRead>();
  const expectedCancellations = new Map<
    Request,
    { responseMissing: boolean; nativeFailure?: string }
  >();
  const nativeFailures = new Map<
    Request,
    {
      error: string | undefined;
      retirementAtFailure: { order: number; url: string } | undefined;
      navigationsAtFailure: { order: number; operation: Promise<void> }[];
    }
  >();
  let stopped = false;
  const observeFailure = (request: Request) => {
    const owned = ownedReads.get(request);
    if (!owned) return;
    const error = request.failure()?.errorText;
    nativeFailures.set(request, {
      error,
      retirementAtFailure: owned.retiredBy,
      // A later navigation cannot retroactively excuse an active-page failure.
      navigationsAtFailure: [...pendingNavigationOrders].map(
        ([order, operation]) => ({ order, operation }),
      ),
    });
    const expected = expectedCancellations.get(request);
    if (expected) expected.nativeFailure = error;
    const removal = removals.get(request);
    if (removal) {
      removal.failureObserved = true;
      removal.nativeFailure = error;
      removal.wake();
    }
  };
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
    pendingNavigationOrders.set(order, observation);
    void observation.finally(() => {
      page.off("framenavigated", captureBoundary);
      pendingNavigations.delete(observation);
      pendingNavigationOrders.delete(order);
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
          const expected = expectedCancellations.get(incoming);
          if (expected) {
            // Provisional only: stop() requires the actual requestfailed event
            // for this exact Request after all observations have been joined.
            expected.responseMissing = true;
            return;
          }
          const removal = removals.get(incoming);
          if (removal) {
            // The action owner must join the real failure and validate removal
            // before this provisional null response can be accepted.
            removal.responseMissing = true;
            return;
          }
          const failed = nativeFailures.get(incoming);
          if (
            failed?.error === "net::ERR_ABORTED" &&
            owned.mainFrame &&
            !incoming.isNavigationRequest()
          ) {
            // Component destruction can abort before the replacing document
            // commits. Join only navigation observations already owned when
            // requestfailed fired, then require the actual root commit/order.
            await Promise.allSettled(
              failed.navigationsAtFailure.map(({ operation }) => operation),
            );
            const retiredBy = owned.retiredBy;
            if (
              retiredBy &&
              (failed.retirementAtFailure?.order === retiredBy.order ||
                failed.navigationsAtFailure.some(
                  ({ order }) => order === retiredBy.order,
                ))
            ) {
              owned.canceled = "retired";
              return;
            }
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
          // Range changes deliberately abort the obsolete calendar fetch. The
          // server handler remains owned by the producer drain below.
          if (
            path === "/api/workspace/calendar/events" &&
            incoming.failure()?.errorText === "net::ERR_ABORTED"
          ) {
            owned.canceled = "superseded";
            return;
          }
          throw new Error(
            `Calendar read failed: ${incoming.failure()?.errorText}`,
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
          owned.canceled = "retired";
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
      !removals.has(request)
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
    const records = requests.map((request) => {
      let wake!: () => void;
      const failure = new Promise<void>((resolve) => {
        wake = resolve;
      });
      const record = {
        responseMissing: false,
        failureObserved: false,
        nativeFailure: undefined as string | undefined,
        failure,
        wake,
      };
      removals.set(request, record);
      return { request, record, owned: ownedReads.get(request)! };
    });
    let closed = page.isClosed();
    const onClose = () => {
      closed = true;
      // Wake a missing-event wait without manufacturing a request failure.
      for (const { record } of records) record.wake();
    };
    page.on("close", onClose);
    try {
      await action();
      if (closed || stopped)
        throw new Error(
          "Removal action closed its page or stopped its observer",
        );
      await Promise.all(
        records.map(({ request }) => readObservations.get(request)!),
      );
      const canceled: OwnedRead[] = [];
      for (const { record, owned } of records) {
        if (
          record.responseMissing &&
          !record.failureObserved &&
          !closed &&
          !stopped
        )
          await record.failure;
        if (closed || stopped || owned.closing)
          throw new Error(
            "Removal action closed its page or stopped its observer",
          );
        if (!owned.settled)
          throw new Error("Removal read has no completed observation");
        if (record.responseMissing) {
          if (
            !record.failureObserved ||
            record.nativeFailure !== "net::ERR_ABORTED"
          )
            throw new Error(
              `Component removal read failed: ${record.nativeFailure ?? "no native requestfailed"}`,
            );
          canceled.push(owned);
        } else if (owned.status === undefined) {
          throw new Error(
            "Removal read has neither a native response nor a proven cancellation",
          );
        }
      }
      // No allowance is finalized until the action and every exact read pass.
      for (const owned of canceled) owned.canceled = "removed";
    } catch (error) {
      errors.push(error);
      throw error;
    } finally {
      page.off("close", onClose);
      for (const { request } of records) removals.delete(request);
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
      page.on("requestfailed", observeFailure);
    },
    expectCancellation(request: Request) {
      const owned = ownedReads.get(request);
      if (
        stopped ||
        !owned ||
        owned.settled ||
        request.failure() ||
        expectedCancellations.has(request) ||
        removals.has(request)
      )
        throw new Error(
          "Cancellation must be declared for an active owned Request before it fails",
        );
      expectedCancellations.set(request, { responseMissing: false });
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
      for (const removal of removals.values()) removal.wake();
      page.off("request", observeRead);
      page.off("requestfailed", observeFailure);
      for (const [request, expected] of expectedCancellations) {
        const owned = ownedReads.get(request);
        if (
          !owned?.settled ||
          !expected.responseMissing ||
          expected.nativeFailure !== "net::ERR_ABORTED"
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
