import type { Page, Request } from "@playwright/test";

/** Own browser observations through full-document replacement and page closure.
 * Server completion remains an independent responsibility of the caller. */
export function ownBrowserReads(
  page: Page,
  origin: string,
  accepting: () => boolean,
) {
  const pendingReads = new Set<Promise<void>>();
  type OwnedRead = {
    requestId: string;
    order: number;
    path: string;
    method: string;
    mainFrame: boolean;
    settled: boolean;
    retiredBy?: { order: number; url: string };
    closing?: boolean;
  };
  const pendingNavigations = new Set<Promise<void>>();
  const navigationCommits: { order: number; url: string }[] = [];
  const navigationObservations: {
    order: number;
    outcome: "committed" | "same-document" | "different-document" | "rejected";
    url?: string;
    error?: string;
  }[] = [];
  const retiredReads: {
    requestId: string;
    method: string;
    path: string;
    order: number;
    retiredBy: { order: number; url: string };
    outcome: "retired-document/page-close";
    error: string;
  }[] = [];
  const errors: unknown[] = [];
  const reads: {
    requestId: string;
    method: string;
    path: string;
    status: number;
    order: number;
  }[] = [];
  const supersededCalendarReads: {
    requestId: string;
    path: string;
    order: number;
  }[] = [];
  const ownedReads = new Map<Request, OwnedRead>();
  function observeNavigation(incoming: Request, order: number) {
    // Register while the root request is admitted, before its response/commit.
    // A matching URL/framenavigated event alone can also be a same-document
    // navigation after a noncommitting 204/download and is not retirement proof.
    const observation = page.waitForNavigation({ waitUntil: "commit" }).then(
      (response) => {
        if (!response) {
          navigationObservations.push({ order, outcome: "same-document" });
          return;
        }
        let root = response.request();
        for (
          let predecessor = root.redirectedFrom();
          predecessor;
          predecessor = root.redirectedFrom()
        )
          root = predecessor;
        if (root !== incoming) {
          navigationObservations.push({
            order,
            outcome: "different-document",
            url: response.url(),
          });
          return;
        }
        const committed = { order, url: response.url() };
        navigationCommits.push(committed);
        navigationObservations.push({ ...committed, outcome: "committed" });
        for (const owned of ownedReads.values())
          if (owned.mainFrame && owned.order < order && !owned.retiredBy)
            owned.retiredBy = committed;
      },
      (error: unknown) => {
        navigationObservations.push({
          order,
          outcome: "rejected",
          error: error instanceof Error ? error.message : String(error),
        });
      },
    );
    pendingNavigations.add(observation);
    void observation.finally(() => pendingNavigations.delete(observation));
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
          // Range changes deliberately abort the obsolete calendar fetch. The
          // server handler remains owned by the producer drain below.
          if (
            path === "/api/workspace/calendar/events" &&
            incoming.failure()?.errorText === "net::ERR_ABORTED"
          ) {
            supersededCalendarReads.push({ requestId, path, order });
            return;
          }
          throw new Error(
            `Calendar read failed: ${incoming.failure()?.errorText}`,
          );
        }
        reads.push({
          requestId,
          method: incoming.method(),
          path,
          status: response.status(),
          order,
        });
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
          retiredReads.push({
            requestId,
            method: owned.method,
            path,
            order,
            retiredBy: owned.retiredBy,
            outcome: "retired-document/page-close",
            error: error.message,
          });
        } else errors.push(error);
      } finally {
        owned.settled = true;
      }
    })();
    pendingReads.add(operation);
    void operation.finally(() => pendingReads.delete(operation));
  }

  return {
    ownedReads,
    reads,
    supersededCalendarReads,
    retiredReads,
    navigationCommits,
    navigationObservations,
    errors,
    pendingReads,
    pendingNavigations,
    start() {
      page.on("request", observeRead);
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
      page.off("request", observeRead);
    },
  };
}
