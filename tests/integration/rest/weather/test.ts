import { expect } from "@playwright/test";
import type { WeatherSnapshot } from "../../../../src/features/weather/server/weather-types";
import { weatherSnapshotResponseSchema } from "../../../../src/lib/api/schemas/weather-response-schemas";
import { isRecord } from "../../../../src/lib/is-record";
import { MCP_BOOTSTRAP_SCOPE } from "../../../../src/lib/oauth/scope-registry";
import type { IsolatedWorker } from "../../../e2e/utils/isolated-worker";
import { test } from "../../../e2e/utils/owned-worker";
import {
  arrangeWeatherCache,
  readWeatherCache,
  weatherProviderFailureResponses,
} from "../../../e2e/utils/weather-cache-fixture";
import { mcpFetchOptions } from "../../../shared/mcp-http-request";
import type { TestPrismaClient } from "../../../shared/prisma";
import { createParityTokenSigner } from "../protocol-contracts/_parity-auth";
import { nativeEnvelope } from "../protocol-contracts/_transport";

async function assertUnchangedWeather(
  origin: string,
  db: TestPrismaClient,
  snapshots: Awaited<ReturnType<typeof arrangeWeatherCache>>,
) {
  for (const snapshot of snapshots)
    expect(await readWeatherCache(origin, snapshot.location.key)).toEqual(
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
  test(name, { tag: "@Weather/REST" }, async ({
    request,
    isolatedWorker,
    run,
  }) => {
    await run(async () => {
      const snapshots = await arrangeWeatherCache(isolatedWorker.origin);
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
        isolatedWorker.origin,
        isolatedWorker.database.owner,
        snapshots,
      );
    });
  });
}

for (const locationKey of ["", "unknown-campus"]) {
  test(`GET /api/catalog/weather rejects location ${JSON.stringify(locationKey)}`, {
    tag: "@Weather/REST",
  }, async ({ request, isolatedWorker, run }) => {
    await run(async () => {
      const snapshots = await arrangeWeatherCache(isolatedWorker.origin);
      const response = await request.get(
        `/api/catalog/weather?locationKey=${encodeURIComponent(locationKey)}`,
      );
      expect(response.status()).toBe(400);
      expect(await response.json()).toEqual({ error: "Invalid weather query" });
      await assertUnchangedWeather(
        isolatedWorker.origin,
        isolatedWorker.database.owner,
        snapshots,
      );
    });
  });
}

test("weather fixture storage restricts authorization and exact location keys", {
  tag: "@Weather/REST",
}, async ({ request, isolatedWorker, run }) => {
  await run(async () => {
    const snapshots = await arrangeWeatherCache(isolatedWorker.origin);
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
      isolatedWorker.origin,
      isolatedWorker.database.owner,
      snapshots,
    );
  });
});

async function databaseSnapshot(worker: IsolatedWorker) {
  const db = worker.database.owner;
  const tables = await db.$queryRaw<
    { tablename: string }[]
  >`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  const result: Record<string, unknown[]> = {};
  for (const { tablename } of tables) {
    const name = tablename.replaceAll('"', '""');
    result[tablename] = await db.$queryRawUnsafe(
      `SELECT row_to_json(t)::text AS row FROM "${name}" t ORDER BY row_to_json(t)::text`,
    );
  }
  return result;
}

test.describe("weather known states through the private Worker", () => {
  test.use({
    workerBindings: { AMAP_API_KEY: "" },
    workerOutboundJson: [weatherProviderFailureResponses, { scope: "test" }],
    workerOutboundRejectOrigins: ["https://api.open-meteo.com"],
  });
  for (const bearer of [false, true]) {
    test(bearer
      ? "weather.known-state-bearer"
      : "weather.known-state-protocols", { tag: "@Weather/REST" }, async ({
      request,
      isolatedWorker,
      run,
    }) => {
      await run(async () => {
        const origin = isolatedWorker.origin;
        let token: string | undefined;
        if (bearer) {
          const actor = await isolatedWorker.createActor();
          const scopes = [MCP_BOOTSTRAP_SCOPE];
          const client = await isolatedWorker.database.owner.oAuthClient.create(
            {
              data: {
                clientId: crypto.randomUUID(),
                name: "Weather read contract",
                redirectUris: ["https://example.test/callback"],
                consents: { create: { userId: actor.id, scopes } },
              },
              include: { consents: true },
            },
          );
          const sign = await createParityTokenSigner(isolatedWorker);
          const issuedAt = Math.floor(Date.now() / 1000);
          token = await sign({
            clientId: client.clientId,
            userId: actor.id,
            grantId: client.consents[0].grantId,
            scopes,
            resource: `${origin}/api/mcp`,
            issuedAt,
            expiresAt: issuedAt + 600,
          });
        }
        const main: WeatherSnapshot = {
          location: { key: "ustc-main", name: "本部", adcode: "340100" },
          fetchedAt: new Date().toISOString(),
          providers: [],
          current: {
            temperature: null,
            condition: { text: "未知", icon: "unknown" },
          },
          hourly: [],
          daily: [],
          alerts: [],
          extensions: {},
        };
        await arrangeWeatherCache(origin, [main]);
        const secret = {
          "x-test-storage-secret": "local-test-storage-observer",
        };
        const missing = await request.get(
          "/__test/storage/weather?locationKey=ustc-gaoxin",
          { headers: secret },
        );
        expect(missing.status()).toBe(404);
        await missing.body();
        const before = await databaseSnapshot(isolatedWorker);
        if (!bearer) {
          expect(before.RuntimeIssueEvent).toEqual([]);
          expect(before.PrometheusCounter).toEqual([]);
        }
        const observationStartedAt = Date.now();
        let unavailableRequestId: string | null = null;
        const id = crypto.randomUUID();
        const probe = `/__test/community-effects?id=${id}`;
        const registration = await request.post(`${probe}&io=1`, {
          headers: secret,
        });
        expect(registration.status()).toBe(201);
        await registration.body();
        const headers = {
          ...secret,
          "x-test-community-probe": id,
          origin,
          "content-type": "application/json",
        };
        let calls = 0;
        const read = async (path: string, init: RequestInit = {}) => {
          calls++;
          return fetch(`${origin}${path}`, {
            ...init,
            headers: { ...headers, ...init.headers },
          });
        };
        try {
          for (const key of ["ustc-main", "ustc-gaoxin"]) {
            if (!bearer) {
              const rest = await read(
                `/api/catalog/weather?locationKey=${key}`,
              );
              const body: unknown = await rest.json();
              expect(rest.status).toBe(key === "ustc-main" ? 200 : 503);
              if (key === "ustc-main")
                expect(weatherSnapshotResponseSchema.parse(body)).toEqual(main);
              else {
                expect(body).toEqual({ error: "Weather data is unavailable" });
                unavailableRequestId = rest.headers.get("x-request-id");
                expect(unavailableRequestId).toMatch(
                  /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i,
                );
              }
              const graph = await read("/api/graphql", {
                method: "POST",
                body: JSON.stringify({
                  query:
                    "query($key: String!) { catalog { weather(locationKey: $key) { location { key } current { temperature } providers hourly { at } daily { date } } } }",
                  variables: { key },
                }),
              });
              const graphBody: unknown = await graph.json();
              expect(graph.status).toBe(200);
              expect(graphBody).toEqual({
                data: {
                  catalog: {
                    weather:
                      key === "ustc-main"
                        ? {
                            location: { key },
                            current: { temperature: null },
                            providers: [],
                            hourly: [],
                            daily: [],
                          }
                        : null,
                  },
                },
              });
            }
            for (const mode of ["default", "full"]) {
              const response = await read(
                "/api/mcp",
                mcpFetchOptions({
                  method: "POST",
                  headers: {
                    ...headers,
                    accept: "application/json, text/event-stream",
                    ...(token ? { authorization: `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method: "tools/call",
                    params: {
                      name: "catalog_weather_get",
                      arguments: { locationKey: key, mode },
                    },
                  }),
                }),
              );
              const envelope: unknown = await nativeEnvelope(response);
              expect(response.status).toBe(200);
              if (
                !isRecord(envelope) ||
                !isRecord(envelope.result) ||
                !Array.isArray(envelope.result.content)
              )
                throw new Error("Expected native MCP result");
              expect(envelope.error).toBeUndefined();
              expect(envelope.result.isError).not.toBe(true);
              const text = envelope.result.content.find(
                (part: unknown) => isRecord(part) && part.type === "text",
              );
              if (!isRecord(text) || typeof text.text !== "string")
                throw new Error("Expected native MCP JSON content");
              const body: unknown = JSON.parse(text.text);
              if (key === "ustc-gaoxin")
                expect(body).toEqual({
                  success: true,
                  locationKey: key,
                  hasData: false,
                  message: "No weather data available",
                });
              else {
                const { extensions: _extensions, ...compact } = main;
                expect(body).toEqual({
                  ...(mode === "full" ? main : compact),
                  success: true,
                });
              }
            }
          }
          const expectedFailures = bearer ? 2 : 4;
          await expect
            .poll(() => isolatedWorker.outboundJsonObservations.matched)
            .toEqual(
              Array(expectedFailures).fill(
                weatherProviderFailureResponses[1].url,
              ),
            );
          expect(isolatedWorker.outboundJsonObservations.rejected).toEqual([]);
          expect(await readWeatherCache(origin, "ustc-main")).toEqual(main);
          const absent = await request.get(
            "/__test/storage/weather?locationKey=ustc-gaoxin",
            { headers: secret },
          );
          expect(absent.status()).toBe(404);
          await absent.body();
          const observation = await request.get(probe, { headers: secret });
          expect(observation.status()).toBe(200);
          const effects: unknown = await observation.json();
          if (
            !isRecord(effects) ||
            !Array.isArray(effects.requests) ||
            !effects.requests.every(isRecord) ||
            !isRecord(effects.io) ||
            !Array.isArray(effects.io.bindings)
          )
            throw new Error("Expected complete weather effects");
          expect(effects).toMatchObject({
            purges: [],
            messages: [],
            backgroundErrors: [],
          });
          expect(effects.requests).toHaveLength(calls);
          expect(
            effects.requests.every((entry) => entry.outcome === "fulfilled"),
          ).toBe(true);
          expect(
            effects.io.bindings.every(
              (entry: unknown) =>
                isRecord(entry) &&
                entry.binding === "WEATHER" &&
                entry.method === "get",
            ),
          ).toBe(true);
          // Bearer verification also performs its canonical owned JWKS self-read.
          const providerOutbound = Array.isArray(effects.io.outbound)
            ? effects.io.outbound.filter(
                (entry: unknown) =>
                  isRecord(entry) &&
                  entry.origin === "https://api.open-meteo.com",
              )
            : [];
          expect(providerOutbound).toEqual(
            Array(expectedFailures).fill({
              method: "GET",
              origin: "https://api.open-meteo.com",
            }),
          );
          if (!Array.isArray(effects.io.outbound))
            throw new Error("Expected outbound observations");
          expect(
            effects.io.outbound.every(
              (entry: unknown) =>
                isRecord(entry) &&
                entry.method === "GET" &&
                (entry.origin === "https://api.open-meteo.com" ||
                  (bearer && entry.origin === origin)),
            ),
          ).toBe(true);
          const after = await databaseSnapshot(isolatedWorker);
          if (!bearer) {
            // The single expected HTTP 503 persists bounded runtime observations.
            // Every business table and every other observability table stays exact.
            const observationEndedAt = Date.now();
            expect(after.RuntimeIssueEvent).toHaveLength(2);
            expect(after.PrometheusCounter).toHaveLength(2);
            const issues =
              await isolatedWorker.database.owner.runtimeIssueEvent.findMany({
                orderBy: { event: "asc" },
              });
            expect(issues).toEqual(
              ["edge.request.finish", "request.finish"].map((event) => ({
                id: expect.stringMatching(
                  /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i,
                ),
                occurredAt: expect.any(Date),
                createdAt: expect.any(Date),
                level: "error",
                event,
                requestId: unavailableRequestId,
                route: null,
                status: 503,
              })),
            );
            expect(new Set(issues.map((issue) => issue.id)).size).toBe(2);
            for (const issue of issues) {
              for (const at of [issue.occurredAt, issue.createdAt]) {
                expect(at.getTime()).toBeGreaterThanOrEqual(
                  observationStartedAt,
                );
                expect(at.getTime()).toBeLessThanOrEqual(observationEndedAt);
              }
            }
            const counters =
              await isolatedWorker.database.owner.prometheusCounter.findMany({
                orderBy: { labels: "asc" },
              });
            expect(
              counters.map(({ kind, labels, value }) => ({
                kind,
                labels: JSON.parse(labels),
                value: value.toString(),
              })),
            ).toEqual(
              ["edge", "request"].map((event) => ({
                kind: "runtime",
                labels: { event, level: "error", status: "5xx" },
                value: "1",
              })),
            );
            expect(after).toEqual({
              ...before,
              RuntimeIssueEvent: after.RuntimeIssueEvent,
              PrometheusCounter: after.PrometheusCounter,
            });
          } else expect(after).toEqual(before);
        } finally {
          const removed = await request.delete(probe, { headers: secret });
          expect(removed.status()).toBe(204);
          await removed.body();
        }
      });
    });
  }
});
