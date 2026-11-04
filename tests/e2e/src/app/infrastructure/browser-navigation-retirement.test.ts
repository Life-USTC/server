import { expect, type Request, type Route } from "@playwright/test";
import { createDeferred } from "../../../../shared/deferred";
import { ownBrowserReads } from "../../../utils/browser-read-lifecycle";
import { test } from "../../../utils/owned-worker";

test("document retirement survives intervening same-document navigation", {
  tag: "@Infrastructure/Runtime",
}, async ({ page, isolatedWorker, run }) => {
  await run(async () => {
    const reader = ownBrowserReads(page, isolatedWorker.origin, () => true);
    const replacementAdmitted = createDeferred();
    const releaseReplacement = createDeferred();
    const historySignal = createDeferred<Route>();
    const reads = new Map<string, Request>();
    const routeOperations: Promise<void>[] = [];
    let replacement: Promise<unknown> | undefined;
    reader.start();
    await page.route("**/history-signal", (route) => {
      historySignal.resolve(route);
    });
    await page.route("**/api/catalog/courses?search=retirement-*", (route) => {
      reads.set(
        new URL(route.request().url()).searchParams.get("search") ?? "",
        route.request(),
      );
    });
    await page.route("**/api/catalog/teachers", (route) => {
      replacementAdmitted.resolve();
      const operation = releaseReplacement.promise.then(() => route.continue());
      routeOperations.push(operation);
      return operation;
    });
    const observedRead = (name: string) => {
      const request = reads.get(name);
      const read = request && reader.ownedReads.get(request);
      if (!read) throw new Error(`Missing owned read: ${name}`);
      return read;
    };
    const startRead = async (name: string) => {
      await page.evaluate((name) => {
        void fetch(`/api/catalog/courses?search=${name}`).catch(
          () => undefined,
        );
      }, name);
      await expect.poll(() => reads.has(name)).toBe(true);
      return observedRead(name);
    };
    try {
      await page.goto("/api/catalog/semesters");
      const early = await startRead("retirement-early");
      // Schedule in the departing document before navigation starts. A new
      // page.evaluate during navigation would wait for the destination context.
      await page.evaluate(() => {
        void fetch("/history-signal").then(() => {
          history.replaceState(null, "", "#first");
          void fetch("/api/catalog/courses?search=retirement-late").catch(
            () => undefined,
          );
          history.replaceState(null, "", "#second");
        });
      });
      const signal = await historySignal.promise;
      replacement = page.goto("/api/catalog/teachers");
      void replacement.catch(() => undefined);
      await replacementAdmitted.promise;
      const historyChanged = page.waitForEvent("framenavigated", {
        predicate: (frame) => frame.url().endsWith("#second"),
      });
      await signal.fulfill({ status: 200, body: "advance history" });
      await historyChanged;
      expect(early.retiredBy).toBeUndefined();
      await expect.poll(() => reads.has("retirement-late")).toBe(true);
      const late = observedRead("retirement-late");
      expect(late.retiredBy).toBeUndefined();
      releaseReplacement.resolve();
      await replacement;
      await expect
        .poll(() => Boolean(early.retiredBy && late.retiredBy))
        .toBe(true);
      expect(early.retiredBy?.url).toBe(
        `${isolatedWorker.origin}/api/catalog/teachers`,
      );
      const active = await startRead("retirement-active");
      expect(active.retiredBy).toBeUndefined();
      expect(() => reader.prepareRetiredClose()).toThrow(
        "An active document read has no browser terminal",
      );
      await page.goto("/api/catalog/semesters?page=2");
      await expect.poll(() => Boolean(active.retiredBy)).toBe(true);
      reader.prepareRetiredClose();
      await page.close();
      await Promise.all([...reader.pendingReads, ...reader.pendingNavigations]);
      expect(reader.errors).toEqual([]);
    } finally {
      releaseReplacement.resolve();
      await replacement?.catch(() => undefined);
      await Promise.all(routeOperations);
      await page.close();
      reader.stop();
      await Promise.all([...reader.pendingReads, ...reader.pendingNavigations]);
    }
  });
});

for (const outcome of ["no-content", "download"] as const) {
  test(`document retirement rejects ${outcome} followed by matching history`, {
    tag: "@Infrastructure/Runtime",
  }, async ({ page, isolatedWorker, run }) => {
    await run(async () => {
      const reader = ownBrowserReads(page, isolatedWorker.origin, () => true);
      const admitted = createDeferred<Request>();
      reader.start();
      await page.route("**/api/catalog/courses?search=active", (route) => {
        admitted.resolve(route.request());
      });
      await page.route(`**/${outcome}`, (route) =>
        route.fulfill(
          outcome === "no-content"
            ? { status: 204 }
            : {
                status: 200,
                headers: {
                  "content-disposition": 'attachment; filename="read.txt"',
                },
                body: "download leaves the current document active",
              },
        ),
      );
      try {
        await page.goto("/api/catalog/semesters");
        await page.evaluate(() => {
          void fetch("/api/catalog/courses?search=active").catch(
            () => undefined,
          );
        });
        const read = reader.ownedReads.get(await admitted.promise);
        if (!read) throw new Error("Missing owned active read");
        const download =
          outcome === "download" ? page.waitForEvent("download") : undefined;
        await expect(page.goto(`/${outcome}`)).rejects.toThrow(
          /ERR_ABORTED|Download is starting/,
        );
        await (await download)?.delete();
        await page.evaluate(
          (outcome) => history.replaceState(null, "", `/${outcome}`),
          outcome,
        );
        expect(read.retiredBy).toBeUndefined();
        expect(() => reader.prepareRetiredClose()).toThrow(
          "An active document read has no browser terminal",
        );
        await page.goto("/api/catalog/teachers");
        await expect.poll(() => Boolean(read.retiredBy)).toBe(true);
        reader.prepareRetiredClose();
        await page.close();
        await Promise.all([
          ...reader.pendingReads,
          ...reader.pendingNavigations,
        ]);
        expect(reader.errors).toEqual([]);
      } finally {
        await page.close();
        reader.stop();
        await Promise.all([
          ...reader.pendingReads,
          ...reader.pendingNavigations,
        ]);
      }
    });
  });
}
