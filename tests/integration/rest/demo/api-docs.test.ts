import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { type APIResponse, expect } from "@playwright/test";
import type { IsolatedWorker } from "../../../e2e/utils/isolated-worker";
import { test } from "../../../e2e/utils/owned-worker";
import { createSignedDemoCookie } from "../../../shared/demo-token";

test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });
const tag = "/api/docs/tag/catalog-section";
const operation = `${tag}/GET/api/catalog/sections`;
const secret = { "x-test-storage-secret": "local-test-storage-observer" };
function privateHeaders(response: APIResponse) {
  expect(response.headers()).toMatchObject({
    "cache-control": "private, no-store",
    "cloudflare-cdn-cache-control": "no-store",
    vary: "Cookie",
    "x-robots-tag": "noindex, nofollow, noarchive",
  });
  expect(response.headers()["x-life-public-navigation"]).toBeUndefined();
}
async function snapshot(worker: IsolatedWorker) {
  const db = worker.database.owner;
  const tables = await db.$queryRaw<
    { tablename: string }[]
  >`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
  const result: Record<string, unknown[]> = {};
  for (const { tablename } of tables)
    result[tablename] = await db.$queryRawUnsafe(
      `SELECT row_to_json(t)::text AS row FROM "${tablename.replaceAll('"', '""')}" t ORDER BY row_to_json(t)::text`,
    );
  return result;
}
for (const locale of ["en-us", "zh-cn"] as const)
  test(`demo API docs read the real local specification and seal effects ${locale}`, {
    tag: "@Account/REST",
  }, async ({ request, isolatedWorker, run }) => {
    await run(async () => {
      const actor = await isolatedWorker.createActor();
      const ordinary = await request.get("/api/openapi");
      expect(ordinary.status()).toBe(200);
      const bytes = await ordinary.body();
      const built = await readFile(
        ".svelte-kit/cloudflare/openapi.generated.json",
      );
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        createHash("sha256").update(built).digest("hex"),
      );
      const ordinaryPage = await request.get(tag);
      expect(ordinaryPage.status()).toBe(200);
      expect(await ordinaryPage.text()).toContain("api-reference");
      const before = await snapshot(isolatedWorker);
      const issuedAt = Math.floor(Date.now() / 1000);
      const signed = await createSignedDemoCookie({ issuedAt });
      const expired = await createSignedDemoCookie({
        issuedAt: issuedAt - 901,
      });
      const cookie = `${signed.name}=${signed.value}; NEXT_LOCALE=${locale}`;
      const probe = `/__test/community-effects?id=${crypto.randomUUID()}`;
      const registration = await request.post(`${probe}&io=1`, {
        headers: secret,
      });
      await registration.body();
      expect(registration.status()).toBe(201);
      let assetReads = 0;
      const read = async (
        path: string,
        status = 200,
        method = "GET",
        extra: Record<string, string> = {},
      ) => {
        const response = await request.fetch(path, {
          method,
          maxRedirects: 0,
          headers: {
            ...secret,
            "x-test-community-probe": probe.split("=")[1],
            cookie,
            origin: isolatedWorker.origin,
            ...extra,
          },
        });
        await response.body();
        expect(response.status(), `${method} ${path}`).toBe(status);
        privateHeaders(response);
        return response;
      };
      const errors: unknown[] = [];
      try {
        for (const path of ["/api-docs", "/api/docs"]) {
          const response = await read(path, 308);
          expect(response.headers().location).toBe(tag);
        }
        for (const path of [tag, operation]) {
          const page = await read(path);
          assetReads++;
          const html = await page.text();
          expect(html).toContain(
            locale === "en-us" ? "Demo account" : "演示账户",
          );
          expect(html).toContain("api-reference");
          const head = await read(path, 200, "HEAD");
          assetReads++;
          expect(await head.text()).toBe("");
          const data = await read(
            `${path}/__data.json?x-sveltekit-invalidated=11`,
          );
          assetReads++;
          expect(await data.text()).toContain("pageDemo");
          expect(await data.text()).toContain("pageLocale");
        }
        const spec = await read("/api/openapi");
        assetReads++;
        expect(await spec.body()).toEqual(bytes);
        const head = await read("/api/openapi", 200, "HEAD");
        assetReads++;
        expect(await head.body()).toHaveLength(0);
        for (const path of [
          "/api/docs/tag/foreign-owned",
          `${tag}/GET/api/foreign-owned`,
        ]) {
          await read(path, 404);
          assetReads++;
        }
        await read("/api/openapi", 403, "POST");
        await read("/api/account/profile", 403, "POST");
        await read("/api/health", 403);
        await read("/api/openapi", 401, "GET", {
          cookie: `${expired.name}=${expired.value}`,
        });
        await read("/api/openapi", 403, "GET", {
          cookie: `${cookie}; ${actor.cookie.name}=${actor.cookie.value}`,
        });
        const response = await request.get(probe, { headers: secret });
        expect(response.status()).toBe(200);
        expect(await response.json()).toMatchObject({
          io: {
            bindings: Array.from({ length: assetReads }, () => ({
              binding: "ASSETS",
              method: "fetch",
            })),
            outbound: [],
          },
          backgroundErrors: [],
        });
        expect(await snapshot(isolatedWorker)).toEqual(before);
      } catch (error) {
        errors.push(error);
      } finally {
        try {
          const response = await request.delete(probe, { headers: secret });
          await response.body();
          expect(response.status()).toBe(204);
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length)
        throw new AggregateError(
          errors,
          "Demo docs contract or cleanup failed",
        );
    });
  });
