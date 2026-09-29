import { readFile } from "node:fs/promises";
import { expect } from "@playwright/test";
import { test as calendarTest } from "../../../utils/calendar-presentation-fixture";

type ExternalRead = {
  method: string;
  path: string;
  requestId: string;
  status: number;
  rpc?: string;
};
type YoungObservation = {
  own: <T>(work: () => Promise<T>) => Promise<T>;
  drain: () => Promise<void>;
  readHeaders: (request: import("@playwright/test").Request) => Record<string, string>;
  headers: (method: string, path: string, status: number) => Record<string, string>;
  sdkFetch: typeof fetch;
  settleSdk: () => Promise<void>;
};

/** These consumers arrange state independently; the shared calendar fixture owns
 * the real Worker/browser, while this feature owns its extra callbacks and SDK IO. */
export const test = calendarTest.extend<{
  youngPoster: Buffer;
  youngRun: (work: (observation: YoungObservation) => Promise<void>) => Promise<void>;
}>({
  youngPoster: async ({ request, run }, use) => {
    const bytes = await run(async () => {
      const bytes = await readFile("public/images/icon.png");
      const path = "/__test/storage/publications?key=young-events%2Fimages%2Fgroup1%2Fcontract%2Fposter.jpg";
      const headers = { "x-test-storage-secret": "local-test-storage-observer", "content-type": "image/png" };
      expect((await request.put(path, { data: bytes })).status()).toBe(404);
      expect((await request.put(`${path}.unapproved`, { headers, data: bytes })).status()).toBe(400);
      expect((await request.put(path, { headers, data: bytes })).status()).toBe(204);
      const stored = await request.get(path, { headers });
      expect(stored.status()).toBe(200);
      expect(stored.headers()["content-type"]).toBe("image/png");
      expect(await stored.body()).toEqual(bytes);
      return bytes;
    });
    await use(bytes);
  },
  youngRun: async ({ calendar, calendarDb, calendarRun, request, run }, use, testInfo) => {
    let operation: Promise<void> | undefined;
    let closing = false;
    try {
      await use((work) => {
        if (closing || operation)
          return Promise.reject(new Error("Young interaction workflow is already owned or closing"));
        operation = run(async () => {
          const pending = new Set<Promise<unknown>>();
          const errors: unknown[] = [];
          const externalReads: ExternalRead[] = [];
          const abort = new AbortController();
          let probeHeaders: Record<string, string> | undefined;
          let accepting = true;
          const remember = (error: unknown) => {
            if (!errors.includes(error)) errors.push(error);
          };
          const own = <T>(work: () => Promise<T>): Promise<T> => {
            const task = accepting
              ? Promise.resolve().then(work)
              : Promise.reject(new Error("Young observations are closing"));
            pending.add(task);
            void task.then(
              () => pending.delete(task),
              (error) => { remember(error); pending.delete(task); },
            );
            return task;
          };
          const drain = async () => {
            while (pending.size) await Promise.allSettled(pending);
          };
          const storedState = () => calendarDb((db) => db.$transaction([
            db.youngEvent.findMany({ orderBy: { id: "asc" } }),
            db.userYoungEventSubscription.findMany({ orderBy: { id: "asc" } }),
            db.userYoungOrganizerSubscription.findMany({ orderBy: [{ userId: "asc" }, { organizerId: "asc" }] }),
            db.youngNotification.findMany({ orderBy: { id: "asc" } }),
          ]));
          const before = await storedState();
          try {
            await calendarRun(async ({ headers, readHeaders }) => {
              probeHeaders = headers;
              const externalHeaders = (method: string, path: string, status: number) => {
                const requestId = crypto.randomUUID();
                externalReads.push({ method, path, requestId, status });
                return { ...headers, "x-test-community-request": requestId };
              };
              const sdkFetch: typeof fetch = (input, init) => own(async () => {
                const incoming = new Request(input, init);
                const url = new URL(incoming.url);
                expect(url.origin).toBe(calendar.origin);
                expect(url.pathname).toBe("/api/mcp");
                const rpc = incoming.method === "POST"
                  ? (await incoming.clone().json() as { method: string }).method
                  : undefined;
                const status = incoming.method === "GET" ? 405
                  : rpc === "notifications/initialized" ? 202 : 200;
                expect(incoming.method === "GET" ||
                  (incoming.method === "POST" && ["initialize", "notifications/initialized", "tools/list"].includes(rpc ?? ""))).toBe(true);
                const tagged = new Headers(incoming.headers);
                for (const [name, value] of Object.entries(externalHeaders(incoming.method, url.pathname, status)))
                  tagged.set(name, value);
                externalReads[externalReads.length - 1].rpc = rpc;
                const response = await fetch(new Request(incoming, {
                  headers: tagged,
                  signal: AbortSignal.any([incoming.signal, abort.signal]),
                }));
                expect(response.status).toBe(status);
                // Current stateless MCP responses are finite. Consume genuine
                // bytes through EOF before handing the same status/body to SDK.
                const body = response.body ? await response.arrayBuffer() : null;
                return new Response(body, {
                  status: response.status,
                  statusText: response.statusText,
                  headers: response.headers,
                });
              });
              try {
                await work({
                  own, drain, readHeaders, headers: externalHeaders, sdkFetch,
                  async settleSdk() {
                    await expect.poll(() => externalReads.filter((read) => read.path === "/api/mcp").length).toBe(4);
                    await drain();
                    expect(externalReads.filter((read) => read.path === "/api/mcp")
                      .map((read) => `${read.method} ${read.rpc ?? "stream"}`).sort()).toEqual([
                        "GET stream", "POST initialize", "POST notifications/initialized", "POST tools/list",
                      ]);
                  },
                });
              } finally {
                abort.abort(new Error("Young interaction SDK observations closing"));
                await drain();
              }
            }, { accountIndex: 0, calendarTokenCreated: false });
          } catch (error) {
            remember(error);
          } finally {
            accepting = false;
            abort.abort(new Error("Young interaction observations closed"));
            await drain();
            // calendarRun has joined native browser reads and effects before this
            // independent persisted-state comparison; shutdown is not the oracle.
            try {
              if (probeHeaders && externalReads.length) {
                const probe = `/__test/community-effects?id=${probeHeaders["x-test-community-probe"]}`;
                const response = await request.get(probe, { headers: probeHeaders });
                expect(response.status()).toBe(200);
                const effects = await response.json();
                const ids = new Set(externalReads.map((read) => read.requestId));
                const actual = effects.requests.filter((item: { value: { requestId?: string } }) => ids.has(item.value.requestId ?? ""));
                const expected = externalReads.map(({ status, rpc: _rpc, ...value }) => ({ outcome: "fulfilled", value, result: status }));
                const byId = (left: { value: { requestId: string } }, right: { value: { requestId: string } }) =>
                  left.value.requestId.localeCompare(right.value.requestId);
                expect(actual.sort(byId)).toEqual(expected.sort(byId));
                expect(effects.messages).toEqual([]);
                expect(effects.purges).toEqual([]);
                expect(effects.backgroundErrors).toEqual([]);
                await testInfo.attach("young-interface-read-effects", {
                  body: JSON.stringify({ externalReads, actual }, null, 2),
                  contentType: "application/json",
                });
              }
              expect(await storedState()).toEqual(before);
              expect(await calendarDb((db) => db.auditLog.count())).toBe(0);
            } catch (error) {
              remember(error);
            }
          }
          if (errors.length) throw new AggregateError(errors, "Owned Young interaction consumer failed");
        });
        return operation;
      });
    } finally {
      closing = true;
      await operation;
    }
  },
});
