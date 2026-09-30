import { type APIRequestContext, request } from "@playwright/test";
import { describe, expect } from "vitest";
import {
  resolveSeedSectionMatch,
  resolveSeedTeacherId,
} from "../e2e/utils/seed-lookups";
import { DEV_SEED } from "../fixtures/dev-seed";
import { nodeHttpTest } from "../shared/node-http-contract-fixture";

const test = nodeHttpTest.extend({
  // biome-ignore lint/correctness/noEmptyPattern: Vitest fixture dependency syntax.
  httpHandler: async ({}, use) => {
    await use((incoming) => {
      const id = Number(incoming.headers.get("x-fixture-record-id"));
      const path = new URL(incoming.url).pathname;
      if (path === "/api/catalog/sections/match-codes") {
        return Response.json({
          sections: id
            ? [{ id, jwId: DEV_SEED.section.jwId, code: DEV_SEED.section.code }]
            : [],
        });
      }
      if (path === "/api/catalog/teachers") {
        return Response.json({
          data: id ? [{ id, code: DEV_SEED.teacher.code }] : [],
        });
      }
      return new Response("Unexpected lookup route", { status: 404 });
    });
  },
});

describe("Catalog lookup request-context independence", () => {
  test.for([
    { name: "section", read: resolveSeedSectionMatch },
    { name: "teacher", read: resolveSeedTeacherId },
  ])(
    "$name observes each context after a missing record and a successful lookup",
    async ({ name, read }, { http, protocolRuntime, signal }) => {
      await protocolRuntime.run(async () => {
        const contexts: APIRequestContext[] = [];
        const failures: unknown[] = [];
        try {
          for (const id of [0, 101, 202]) {
            const context = await request.newContext({
              baseURL: http.origin,
              extraHTTPHeaders: { "x-fixture-record-id": String(id) },
            });
            // Register the acquired context before checking cancellation.
            contexts.push(context);
            signal.throwIfAborted();
          }
          await expect(read(contexts[0])).rejects.toThrow("not found");
          expect(await read(contexts[1])).toEqual(
            name === "section"
              ? { id: 101, jwId: DEV_SEED.section.jwId, code: DEV_SEED.section.code }
              : 101,
          );
          expect(await read(contexts[2])).toEqual(
            name === "section"
              ? { id: 202, jwId: DEV_SEED.section.jwId, code: DEV_SEED.section.code }
              : 202,
          );
        } catch (error) {
          failures.push(error);
        }
        const results = await Promise.allSettled(
          contexts.map((context) =>
            Promise.resolve().then(() => context.dispose()),
          ),
        );
        failures.push(
          ...results.flatMap((result) =>
            result.status === "rejected" ? [result.reason] : [],
          ),
        );
        if (failures.length === 1) throw failures[0];
        if (failures.length)
          throw new AggregateError(failures, "Lookup workflow and cleanup failed");
      });
    },
  );
});
