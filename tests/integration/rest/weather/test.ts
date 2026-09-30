import { type APIRequestContext, expect } from "@playwright/test";
import { test } from "../../../e2e/utils/owned-worker";
import {
  arrangeWeatherCache,
  readWeatherCache,
} from "../../../e2e/utils/weather-cache-fixture";
import type { TestPrismaClient } from "../../../shared/prisma";

async function assertUnchangedWeather(
  request: APIRequestContext,
  db: TestPrismaClient,
  snapshots: Awaited<ReturnType<typeof arrangeWeatherCache>>,
) {
  for (const snapshot of snapshots)
    expect(await readWeatherCache(request, snapshot.location.key)).toEqual(
      snapshot,
    );
  expect(await db.weatherObservation.findMany()).toEqual([]);
}

for (const [name, query, locationKey] of [
  [
    "GET /api/catalog/weather route is wired",
    "?locationKey=ustc-main",
    "ustc-main",
  ],
  [
    "GET /api/catalog/weather consumes the Gaoxin cache",
    "?locationKey=ustc-gaoxin",
    "ustc-gaoxin",
  ],
  ["GET /api/catalog/weather defaults to main campus", "", "ustc-main"],
] as const) {
  test(name, async ({ request, isolatedWorker, run }) => {
    await run(async () => {
      const snapshots = await arrangeWeatherCache(request);
      expect(
        await isolatedWorker.database.owner.weatherObservation.findMany(),
      ).toEqual([]);
      const expected = snapshots.find(
        (snapshot) => snapshot.location.key === locationKey,
      );
      if (!expected) throw new Error("Missing explicit weather expectation");
      const response = await request.get(`/api/catalog/weather${query}`);
      expect(response.status()).toBe(200);
      expect(response.headers()["cache-control"]).toBe("private, no-store");
      expect(response.headers()["cloudflare-cdn-cache-control"]).toBe(
        "no-store",
      );
      const body = await response.json();
      expect(body.location.key).toBe(locationKey);
      expect(typeof body.current.temperature).toBe("number");
      expect(body).toEqual(expected);
      await assertUnchangedWeather(
        request,
        isolatedWorker.database.owner,
        snapshots,
      );
    });
  });
}

for (const locationKey of ["", "unknown-campus"]) {
  test(`GET /api/catalog/weather rejects location ${JSON.stringify(locationKey)}`, async ({
    request,
    isolatedWorker,
    run,
  }) => {
    await run(async () => {
      const snapshots = await arrangeWeatherCache(request);
      const response = await request.get(
        `/api/catalog/weather?locationKey=${encodeURIComponent(locationKey)}`,
      );
      expect(response.status()).toBe(400);
      expect(await response.json()).toEqual({ error: "Invalid weather query" });
      await assertUnchangedWeather(
        request,
        isolatedWorker.database.owner,
        snapshots,
      );
    });
  });
}

test("weather fixture storage restricts authorization and exact location keys", async ({
  request,
  isolatedWorker,
  run,
}) => {
  await run(async () => {
    const snapshots = await arrangeWeatherCache(request);
    const path = "/__test/storage/weather?locationKey=ustc-main";
    const headers = { "x-test-storage-secret": "local-test-storage-observer" };
    for (const method of ["GET", "PUT"] as const) {
      const response = await request.fetch(path, {
        method,
        ...(method === "PUT" ? { data: snapshots[1] } : {}),
      });
      expect(response.status()).toBe(404);
      await response.body();
    }
    const wrongSecret = await request.get(path, {
      headers: { "x-test-storage-secret": "wrong-test-secret" },
    });
    expect(wrongSecret.status()).toBe(404);
    await wrongSecret.body();
    const unknown = await request.put(
      "/__test/storage/weather?locationKey=other-namespace-key",
      { headers, data: snapshots[0] },
    );
    expect(unknown.status()).toBe(400);
    await unknown.body();
    const mismatched = await request.put(path, { headers, data: snapshots[1] });
    expect(mismatched.status()).toBe(400);
    await mismatched.body();
    const invalidJson = await request.put(path, { headers, data: "{" });
    expect(invalidJson.status()).toBe(400);
    await invalidJson.body();
    const deletion = await request.delete(path, { headers });
    expect(deletion.status()).toBe(405);
    await deletion.body();
    await assertUnchangedWeather(
      request,
      isolatedWorker.database.owner,
      snapshots,
    );
  });
});
