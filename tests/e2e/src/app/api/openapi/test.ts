/**
 * E2E tests for GET /api/openapi
 *
 * ## Endpoints
 * - `GET /api/openapi` — Get the generated OpenAPI specification document.
 *
 * ## Request
 * - No query params
 *
 * ## Response
 * - 200: Full OpenAPI 3.0.0 JSON spec `{ openapi: "3.0.0", info: { title, version }, paths: {...} }`
 *
 * ## Auth Requirements
 * - Public (no authentication required)
 *
 * ## Edge Cases
 * - Reads from public/openapi.generated.json on disk
 * - Static file at /openapi.generated.json should also be accessible
 */
import { expect, test } from "@playwright/test";
import { assertApiContract } from "../../_shared/api-contract";

test.describe("GET /api/openapi", () => {
  test("contract", async ({ request }) => {
    await assertApiContract(request, { routePath: "/api/openapi" });
  });

  test("returns valid OpenAPI 3.0.0 spec", async ({ request }) => {
    const response = await request.get("/api/openapi");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      openapi?: string;
      info?: { title?: string; version?: string };
    };
    expect(body.openapi).toBe("3.0.0");
    expect(body.info).toBeDefined();
    expect(typeof body.info?.title).toBe("string");
  });

  test("spec contains known API paths", async ({ request }) => {
    const response = await request.get("/api/openapi");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      paths?: Record<string, { get?: unknown; options?: unknown }>;
    };
    expect(body.paths).toBeDefined();
    expect(body.paths?.["/api/sections/match-codes"]).toBeTruthy();
    expect(body.paths?.["/api/homeworks"]).toBeTruthy();
    expect(body.paths?.["/api/descriptions"]).toBeTruthy();
    expect(
      body.paths?.["/api/auth/.well-known/openid-configuration"]?.get,
    ).toBeTruthy();
    expect(body.paths?.["/.well-known/openid-configuration"]?.get).toBeTruthy();
    expect(
      body.paths?.["/.well-known/openid-configuration"]?.options,
    ).toBeTruthy();
  });

  test("spec exposes concrete schemas for generated clients", async ({
    request,
  }) => {
    const response = await request.get("/api/openapi");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      paths?: Record<
        string,
        {
          get?: {
            parameters?: Array<{
              name?: string;
              schema?: { type?: string; format?: string };
            }>;
          };
        }
      >;
      components?: { schemas?: Record<string, unknown> };
    };

    expect(
      body.components?.schemas?.adminHomeworksResponseSchema,
    ).toMatchObject({
      type: "object",
    });
    expect(body.components?.schemas?.adminHomeworksResponseSchema).not.toEqual(
      {},
    );

    const adminHomeworksLimit = body.paths?.[
      "/api/admin/homeworks"
    ]?.get?.parameters?.find((parameter) => parameter.name === "limit");
    expect(adminHomeworksLimit?.schema).toMatchObject({
      type: "integer",
      format: "int64",
    });
  });

  test("redirect-only endpoints keep redirect response codes in the spec", async ({
    request,
  }) => {
    const response = await request.get("/api/openapi");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      paths?: Record<
        string,
        {
          get?: { responses?: Record<string, unknown> };
          post?: { responses?: Record<string, unknown> };
        }
      >;
    };

    expect(
      body.paths?.["/api/uploads/{id}/download"]?.get?.responses?.["302"],
    ).toBeTruthy();
    expect(
      body.paths?.["/api/uploads/{id}/download"]?.get?.responses?.["200"],
    ).toBeUndefined();
    expect(
      body.paths?.["/api/dashboard-links/visit"]?.get?.responses?.["307"],
    ).toBeTruthy();
    expect(
      body.paths?.["/api/dashboard-links/visit"]?.post?.responses?.["303"],
    ).toBeTruthy();
  });

  test("static openapi.generated.json is accessible", async ({ request }) => {
    const response = await request.get("/openapi.generated.json");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/json");
    const body = (await response.json()) as {
      openapi?: string;
      info?: { title?: string };
    };
    expect(body.openapi).toBe("3.0.0");
    expect(body.info?.title).toBe("Life@USTC API");
  });
});
