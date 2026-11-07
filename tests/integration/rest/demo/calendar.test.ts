import { expect } from "@playwright/test";
import { test } from "../../../e2e/utils/owned-worker";
import { createSignedDemoCookie } from "../../../shared/demo-token";

test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });
test("demo calendar isolates real owners, paginates fixed facts and rejects writes and forged identities", {
  tag: "@Account/REST",
}, async ({ request, isolatedWorker, run }) => {
  await run(async () => {
    const actor = await isolatedWorker.createActor();
    const db = isolatedWorker.database.owner;
    const victim = await db.todo.create({
      data: {
        userId: actor.id,
        title: "Private calendar victim",
        dueAt: new Date("2026-09-24T10:00:00+08:00"),
      },
    });
    const snapshot = await db.todo.findUniqueOrThrow({
      where: { id: victim.id },
    });
    const signed = await createSignedDemoCookie({
      issuedAt: Math.floor(Date.now() / 1000),
    });
    const expired = await createSignedDemoCookie({
      issuedAt: Math.floor(Date.now() / 1000) - 901,
    });
    const secret = { "x-test-storage-secret": "local-test-storage-observer" };
    const id = crypto.randomUUID();
    const probe = `/__test/community-effects?id=${id}`;
    const headers = {
      ...secret,
      "x-test-community-probe": id,
      cookie: `${signed.name}=${signed.value}; NEXT_LOCALE=en-us`,
      origin: isolatedWorker.origin,
    };
    const registration = await request.post(`${probe}&io=1`, {
      headers: secret,
    });
    expect(registration.status()).toBe(201);
    await registration.body();
    const path =
      "/api/workspace/calendar/events?dateFrom=2026-09-01&dateTo=2027-01-24&pageSize=2";
    try {
      const items: { id: string; title: string; type: string }[] = [];
      for (let page = 1; page <= 5; page++) {
        const response = await request.get(`${path}&page=${page}`, { headers });
        expect(response.status()).toBe(200);
        expect(response.headers()).toMatchObject({
          "cache-control": "private, no-store",
          "cloudflare-cdn-cache-control": "no-store",
          vary: "Cookie",
          "x-robots-tag": "noindex, nofollow, noarchive",
        });
        const body = await response.json();
        expect(body.pagination).toEqual({
          page,
          pageSize: 2,
          total: 9,
          totalPages: 5,
        });
        items.push(...body.data);
      }
      expect(new Set(items.map(({ id }) => id)).size).toBe(9);
      expect(
        items.some(
          ({ id, title }) => id.includes(victim.id) || title === victim.title,
        ),
      ).toBe(false);
      expect(items.filter(({ type }) => type === "exam")).toHaveLength(2);
      for (const [cookie, status] of [
        ["life-ustc.demo=invalid", 401],
        [`${expired.name}=${expired.value}`, 401],
        [
          `${signed.name}=${signed.value}; ${actor.cookie.name}=${actor.cookie.value}`,
          403,
        ],
      ] as const) {
        const response = await request.get(path, {
          headers: { ...headers, cookie },
        });
        expect(response.status()).toBe(status);
        await response.body();
      }
      for (const query of ["userId=victim", "pageSize=101"]) {
        const response = await request.get(
          `/api/workspace/calendar/events?${query}`,
          { headers },
        );
        expect(response.status()).toBe(400);
        await response.body();
      }
      for (const method of ["POST", "PATCH", "DELETE"]) {
        const response = await request.fetch("/api/workspace/calendar/events", {
          method,
          headers,
          data: { userId: actor.id },
        });
        expect(response.status()).toBe(403);
        await response.body();
      }
      const effects = await (
        await request.get(probe, { headers: secret })
      ).json();
      expect(effects).toMatchObject({
        purges: [],
        messages: [],
        backgroundErrors: [],
        io: { bindings: [], outbound: [] },
      });
      expect(effects.requests.length).toBeGreaterThan(10);
      expect(
        effects.requests.every(
          (entry: { outcome: string }) => entry.outcome === "fulfilled",
        ),
      ).toBe(true);
      expect(
        await db.todo.findUniqueOrThrow({ where: { id: victim.id } }),
      ).toEqual(snapshot);
      // The ordinary authenticated branch still reads its actual owner, outside the demo probe.
      const real = await request.get(path, {
        headers: { cookie: `${actor.cookie.name}=${actor.cookie.value}` },
      });
      expect(real.status()).toBe(200);
      const body = await real.json();
      expect(body.data).toEqual([
        expect.objectContaining({ target: { kind: "todo", id: victim.id } }),
      ]);
    } finally {
      const removed = await request.delete(probe, { headers: secret });
      expect(removed.status()).toBe(204);
      await removed.body();
    }
  });
});
