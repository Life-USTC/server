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
      body.paths?.["/.well-known/openid-configuration/api/auth"]?.get,
    ).toBeTruthy();
    expect(body.paths?.["/.well-known/openid-configuration"]?.get).toBeTruthy();
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

  test("request bodies and redirect endpoints stay accurate in the spec", async ({
    request,
  }) => {
    const response = await request.get("/api/openapi");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      paths?: Record<
        string,
        {
          get?: { responses?: Record<string, unknown> };
          options?: { responses?: Record<string, unknown> };
          post?: {
            requestBody?: {
              required?: boolean;
              content?: Record<
                string,
                { schema?: { $ref?: string; type?: string; format?: string } }
              >;
            };
            responses?: Record<string, unknown>;
          };
          put?: {
            requestBody?: {
              required?: boolean;
              content?: Record<
                string,
                { schema?: { $ref?: string; type?: string; format?: string } }
              >;
            };
          };
        }
      >;
    };

    expect(body.paths?.["/api/todos"]?.post?.requestBody?.required).toBe(true);
    expect(
      body.paths?.["/api/todos"]?.post?.requestBody?.content?.[
        "application/json"
      ]?.schema?.$ref,
    ).toBe("#/components/schemas/todoCreateRequestSchema");
    expect(
      body.paths?.["/api/uploads/object"]?.put?.requestBody?.content?.[
        "application/octet-stream"
      ]?.schema,
    ).toEqual({ type: "string", format: "binary" });
    expect(
      body.paths?.["/api/uploads/{id}/download"]?.get?.responses?.["200"],
    ).toBeTruthy();
    expect(
      body.paths?.["/api/uploads/{id}/download"]?.get?.responses?.["302"],
    ).toBeUndefined();
    expect(
      body.paths?.["/api/dashboard-links/visit"]?.get?.responses?.["307"],
    ).toBeTruthy();
    expect(
      body.paths?.["/api/dashboard-links/visit"]?.post?.responses?.["303"],
    ).toBeTruthy();
    expect(
      body.paths?.["/api/auth/oauth2/device-authorization"]?.options
        ?.responses?.["204"],
    ).toBeTruthy();
  });

  test("spec exposes auth security metadata", async ({ request }) => {
    const response = await request.get("/api/openapi");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      components?: { securitySchemes?: Record<string, unknown> };
      paths?: Record<
        string,
        {
          get?: { parameters?: unknown[]; security?: unknown[] };
          options?: { security?: unknown[] };
          post?: { security?: unknown[] };
        }
      >;
    };

    expect(Object.keys(body.components?.securitySchemes ?? {})).toEqual(
      expect.arrayContaining([
        "bearerAuth",
        "sessionCookie",
        "mcpBearerAuth",
        "calendarFeedToken",
      ]),
    );
    expect(body.paths?.["/api/todos"]?.get?.security).toEqual([
      { bearerAuth: [] },
      { sessionCookie: [] },
    ]);
    expect(body.paths?.["/api/mcp"]?.get?.security).toEqual([
      { mcpBearerAuth: [] },
    ]);
    expect(
      body.paths?.["/api/users/{userId}/calendar.ics"]?.get?.security,
    ).toEqual([
      { bearerAuth: [] },
      { sessionCookie: [] },
      { calendarFeedToken: [] },
    ]);
    expect(body.paths?.["/api/mcp"]?.options?.security).toBeUndefined();
    expect(body.paths?.["/api/users/profile"]?.get?.security).toBeUndefined();
    expect(
      body.paths?.["/api/auth/oauth2/token"]?.post?.security,
    ).toBeUndefined();
    expect(
      body.paths?.["/api/users/{userId}/calendar.ics"]?.get?.parameters,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ in: "query", name: "token" }),
      ]),
    );
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
