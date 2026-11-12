import { expect } from "@playwright/test";
import { isRecord } from "@/lib/is-record";
import { MCP_BOOTSTRAP_SCOPE } from "@/lib/oauth/scope-registry";
import type { IsolatedWorker } from "../../../e2e/utils/isolated-worker";
import { test } from "../../../e2e/utils/owned-worker";
import { createCatalogContractFixture } from "../../../shared/catalog-contract-fixture";
import { mcpFetchOptions } from "../../../shared/mcp-http-request";
import { createParityTokenSigner } from "./_parity-auth";
import { nativeEnvelope } from "./_transport";

const document = `query CachedCourse($jwId:Int!, $hide:Boolean!, $show:Boolean!) {
  selected: catalog @skip(if:$hide) {
    course(jwId:$jwId) { id code @include(if:$show) ...Name @include(if:$show) }
  }
} fragment Name on Course { nameCn }`;

async function businessSnapshot(worker: IsolatedWorker) {
  const db = worker.database.owner;
  const tables = await db.$queryRaw<
    { tablename: string }[]
  >`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
  const rows: Record<string, unknown[]> = {};
  for (const { tablename } of tables) {
    // Normal feature-read observations and their derived counters are not business writes.
    // Every other table, including OAuth usage, audit and runtime errors, remains exact.
    if (["FeatureOperationEvent", "PrometheusCounter"].includes(tablename))
      continue;
    rows[tablename] = await db.$queryRawUnsafe(
      `SELECT row_to_json(t)::text AS row FROM "${tablename.replaceAll('"', '""')}" t ORDER BY row_to_json(t)::text`,
    );
  }
  return rows;
}

function counterKey(kind: string, labels: string) {
  const parsed: unknown = JSON.parse(labels);
  if (!isRecord(parsed)) throw new Error("Expected counter label object");
  return JSON.stringify([
    kind,
    Object.entries(parsed).sort(([a], [b]) => a.localeCompare(b)),
  ]);
}

for (const transport of ["HTTP", "registered MCP", "document MCP"] as const) {
  test(
    `graphql.executor variable isolation through ${transport}`,
    {
      tag: `@Course/${transport === "HTTP" ? "GraphQL" : "MCP"}`,
    },
    async ({ isolatedWorker, request, run }) =>
      run(async () => {
        const { origin, database } = isolatedWorker;
        const fixture = await createCatalogContractFixture(database.owner);
        const a = await database.owner.course.update({
          where: { id: fixture.courses[0].id },
          data: { code: "EXECUTOR-A", nameCn: "Executor A" },
        });
        const b = await database.owner.course.update({
          where: { id: fixture.courses[1].id },
          data: { code: "EXECUTOR-B", nameCn: "Executor B" },
        });
        let token: string | undefined;
        let observedUser: string | null = null;
        if (transport !== "HTTP") {
          const actor = await isolatedWorker.createActor();
          observedUser = actor.id;
          const scopes = [MCP_BOOTSTRAP_SCOPE];
          const client = await database.owner.oAuthClient.create({
            data: {
              clientId: crypto.randomUUID(),
              name: "Executor read contract",
              redirectUris: ["https://example.test/callback"],
              consents: { create: { userId: actor.id, scopes } },
            },
            include: { consents: true },
          });
          const sign = await createParityTokenSigner(isolatedWorker);
          const now = Math.floor(Date.now() / 1000);
          token = await sign({
            clientId: client.clientId,
            grantId: client.consents[0].grantId,
            userId: actor.id,
            scopes,
            resource: `${origin}/api/mcp`,
            issuedAt: now,
            expiresAt: now + 600,
          });
        }
        const before = await businessSnapshot(isolatedWorker);
        const beforeEvents =
          await database.owner.featureOperationEvent.findMany();
        const beforeCounters =
          await database.owner.prometheusCounter.findMany();
        const startedAt = Date.now();
        const probe = `/__test/community-effects?id=${crypto.randomUUID()}`;
        const secret = {
          "x-test-storage-secret": "local-test-storage-observer",
        };
        const registration = await request.post(`${probe}&io=1`, {
          headers: secret,
        });
        await registration.body();
        expect(registration.status()).toBe(201);
        const probeId = new URL(probe, origin).searchParams.get("id");
        if (!probeId) throw new Error("Missing owned probe ID");
        const headers = {
          ...secret,
          "x-test-community-probe": probeId,
          origin,
          "content-type": "application/json",
          "accept-language": "zh-CN",
        };
        const sequence =
          transport === "registered MCP"
            ? [
                {
                  variables: { jwId: a.jwId },
                  expected: {
                    catalog: {
                      course: {
                        id: a.id,
                        code: "EXECUTOR-A",
                        nameCn: "Executor A",
                      },
                    },
                  },
                },
                {
                  variables: { jwId: b.jwId },
                  expected: {
                    catalog: {
                      course: {
                        id: b.id,
                        code: "EXECUTOR-B",
                        nameCn: "Executor B",
                      },
                    },
                  },
                },
                {
                  variables: { jwId: 2_147_483_647 },
                  expected: { catalog: { course: null } },
                },
                {
                  variables: { jwId: a.jwId },
                  expected: {
                    catalog: {
                      course: {
                        id: a.id,
                        code: "EXECUTOR-A",
                        nameCn: "Executor A",
                      },
                    },
                  },
                },
              ]
            : [
                {
                  variables: { jwId: a.jwId, hide: false, show: true },
                  expected: {
                    selected: {
                      course: {
                        id: a.id,
                        code: "EXECUTOR-A",
                        nameCn: "Executor A",
                      },
                    },
                  },
                },
                {
                  variables: { jwId: b.jwId, hide: false, show: false },
                  expected: { selected: { course: { id: b.id } } },
                },
                {
                  variables: { jwId: a.jwId, hide: true, show: true },
                  expected: {},
                },
                {
                  variables: { jwId: a.jwId, hide: false, show: true },
                  expected: {
                    selected: {
                      course: {
                        id: a.id,
                        code: "EXECUTOR-A",
                        nameCn: "Executor A",
                      },
                    },
                  },
                },
              ];
        const expectedEvents = new Map<
          string,
          { outcome: string; errorClass: string }
        >();
        try {
          for (const [index, { variables, expected }] of sequence.entries()) {
            const response = await fetch(
              `${origin}/api/${transport === "HTTP" ? "graphql" : "mcp"}`,
              transport === "HTTP"
                ? {
                    method: "POST",
                    headers,
                    body: JSON.stringify({ query: document, variables }),
                  }
                : mcpFetchOptions({
                    method: "POST",
                    headers: {
                      ...headers,
                      authorization: `Bearer ${token}`,
                      accept: "application/json, text/event-stream",
                    },
                    body: JSON.stringify({
                      jsonrpc: "2.0",
                      id: 1,
                      method: "tools/call",
                      params: {
                        name: "graphql_operation_run",
                        arguments: {
                          ...(transport === "registered MCP"
                            ? { operationId: "catalog.course.get.v1" }
                            : { document, operationName: "CachedCourse" }),
                          variables,
                          locale: "zh-cn",
                        },
                      },
                    }),
                  }),
            );
            const envelope: unknown = await nativeEnvelope(response);
            expect(response.status).toBe(200);
            const responseId = response.headers.get("x-request-id");
            expect(responseId).toMatch(
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
            );
            if (!responseId) throw new Error("Missing response request ID");
            if (index !== 2 || transport === "registered MCP") {
              expect(expectedEvents.has(responseId)).toBe(false);
              expectedEvents.set(
                responseId,
                index === 2
                  ? { outcome: "rejected", errorClass: "not_found" }
                  : { outcome: "success", errorClass: "none" },
              );
            }
            if (!isRecord(envelope))
              throw new Error("Expected native GraphQL envelope");
            let result = envelope;
            if (transport !== "HTTP") {
              expect(envelope.error).toBeUndefined();
              if (
                !isRecord(envelope.result) ||
                !Array.isArray(envelope.result.content)
              )
                throw new Error("Expected native MCP result");
              expect(envelope.result.isError).not.toBe(true);
              const text = envelope.result.content.find(
                (part: unknown) => isRecord(part) && part.type === "text",
              );
              if (!isRecord(text) || typeof text.text !== "string")
                throw new Error("Expected MCP JSON content");
              const decoded: unknown = JSON.parse(text.text);
              if (!isRecord(decoded))
                throw new Error("Expected GraphQL operation result");
              result = decoded;
              expect(result.success).toBe(true);
            }
            expect(result.errors).toBeUndefined();
            if (transport === "registered MCP")
              expect(result.data).toMatchObject(expected);
            else expect(result.data).toEqual(expected);
          }
          const observation = await request.get(probe, { headers: secret });
          const effects: unknown = await observation.json();
          expect(observation.status()).toBe(200);
          if (
            !isRecord(effects) ||
            !Array.isArray(effects.requests) ||
            !effects.requests.every(isRecord) ||
            !isRecord(effects.io) ||
            !Array.isArray(effects.io.outbound)
          )
            throw new Error("Expected complete owned effects");
          expect(effects).toMatchObject({
            purges: [],
            messages: [],
            backgroundErrors: [],
            io: { bindings: [] },
          });
          expect(effects.requests).toHaveLength(4);
          expect(
            effects.requests.every(
              (entry) => entry.outcome === "fulfilled" && entry.result === 200,
            ),
          ).toBe(true);
          expect(effects.io.outbound).toEqual(
            transport === "HTTP" ? [] : [{ method: "GET", origin }],
          );
          const expectedCount = transport === "registered MCP" ? 4 : 3;
          await expect
            .poll(async () => database.owner.featureOperationEvent.count())
            .toBe(beforeEvents.length + expectedCount);
          const endedAt = Date.now();
          const afterEvents =
            await database.owner.featureOperationEvent.findMany();
          for (const previous of beforeEvents)
            expect(
              afterEvents.find((event) => event.id === previous.id),
            ).toEqual(previous);
          const oldIds = new Set(beforeEvents.map((event) => event.id));
          const added = afterEvents.filter((event) => !oldIds.has(event.id));
          expect(added).toHaveLength(expectedCount);
          expect(added.map((event) => event.requestId).sort()).toEqual(
            [...expectedEvents.keys()].sort(),
          );
          const uuid =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          expect(new Set(added.map((event) => event.requestId)).size).toBe(
            expectedCount,
          );
          expect(
            added.filter((event) => event.outcome === "rejected"),
          ).toHaveLength(transport === "registered MCP" ? 1 : 0);
          const increments = new Map<string, number>();
          const add = (
            kind: string,
            labels: Record<string, string>,
            value: number,
          ) => {
            const key = counterKey(kind, JSON.stringify(labels));
            increments.set(key, (increments.get(key) ?? 0) + value);
          };
          for (const event of added) {
            expect(event.id).toMatch(uuid);
            expect(event.requestId).toMatch(uuid);
            if (!event.requestId) throw new Error("Missing feature request ID");
            const expectedEvent = expectedEvents.get(event.requestId);
            expect(expectedEvent).toBeDefined();
            if (!expectedEvent)
              throw new Error("Unexpected feature request ID");
            expect(event).toMatchObject(expectedEvent);
            expect(event).toMatchObject({
              feature: "catalog.course",
              operation: "get",
              protocol: "graphql",
              surface: transport === "HTTP" ? "unknown" : "mcp",
              authMode: transport === "HTTP" ? "anonymous" : "oauth",
              userId: observedUser,
            });
            expect(["success", "rejected"]).toContain(event.outcome);
            expect(event.errorClass).toBe(
              event.outcome === "success" ? "none" : "not_found",
            );
            for (const at of [event.occurredAt, event.createdAt]) {
              expect(at.getTime()).toBeGreaterThanOrEqual(startedAt);
              expect(at.getTime()).toBeLessThanOrEqual(endedAt);
            }
            expect(Number.isFinite(event.durationMs)).toBe(true);
            expect(event.durationMs).toBeGreaterThanOrEqual(0);
            expect(event.durationMs).toBeLessThanOrEqual(endedAt - startedAt);
            const labels = {
              feature: "catalog.course",
              operation: "get",
              protocol: "graphql",
            };
            add(
              "features",
              {
                ...labels,
                surface: event.surface,
                auth_mode: event.authMode,
                outcome: event.outcome,
              },
              1,
            );
            add("duration_count", labels, 1);
            add("duration_sum", labels, event.durationMs / 1000);
            for (const [index, bound] of [
              5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000,
            ].entries())
              add(
                `duration_bucket_${String(index).padStart(2, "0")}`,
                labels,
                event.durationMs <= bound ? 1 : 0,
              );
          }
          const afterCounters =
            await database.owner.prometheusCounter.findMany();
          const remaining = new Map(
            afterCounters.map((counter) => [
              counterKey(counter.kind, counter.labels),
              counter,
            ]),
          );
          for (const previous of beforeCounters) {
            const key = counterKey(previous.kind, previous.labels);
            const current = remaining.get(key);
            expect(current).toBeDefined();
            if (!current) throw new Error("Existing counter disappeared");
            const delta = increments.get(key);
            if (delta === undefined) expect(current).toEqual(previous);
            else {
              const expected = Number(previous.value) + delta;
              if (previous.kind === "duration_sum")
                expect(Number(current.value)).toBeCloseTo(expected, 12);
              else expect(Number(current.value)).toBe(expected);
              increments.delete(key);
            }
            remaining.delete(key);
          }
          expect(remaining.size).toBe(increments.size);
          for (const [key, delta] of increments) {
            const current = remaining.get(key);
            expect(current).toBeDefined();
            if (!current) throw new Error("Expected feature counter missing");
            if (current.kind === "duration_sum")
              expect(Number(current.value)).toBeCloseTo(delta, 12);
            else expect(Number(current.value)).toBe(delta);
          }
          expect(await businessSnapshot(isolatedWorker)).toEqual(before);
        } finally {
          const removed = await request.delete(probe, { headers: secret });
          await removed.body();
          expect(removed.status()).toBe(204);
        }
      }),
  );
}
