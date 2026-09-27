import { beforeAll, describe, expect, it } from "vitest";
import { isFeatureScope } from "@/lib/oauth/scope-registry";
import committedDocument from "../../../../public/openapi.generated.json";
import { generateOpenApiDocument } from "../../../../scripts/openapi/generate";

describe("openapi generator", () => {
  let doc: ReturnType<typeof generateOpenApiDocument>;

  beforeAll(() => {
    doc = generateOpenApiDocument();
  }, 60_000);

  it("openapi.openapi-drift-gate", () => {
    expect(doc).toEqual(committedDocument);
  });

  it("openapi.security-schemes", () => {
    let bearerOperations = 0;
    for (const [path, methods] of Object.entries(doc.paths ?? {})) {
      for (const [method, raw] of Object.entries(methods)) {
        if (!raw || typeof raw !== "object" || !("responses" in raw)) continue;
        const operation = raw as {
          security?: Record<string, string[]>[];
          "x-oauth-scopes"?: string[];
          responses?: Record<string, unknown>;
        };
        if (
          (path.startsWith("/api/workspace/") ||
            path.startsWith("/api/community/")) &&
          operation.responses?.["401"]
        ) {
          expect(
            operation["x-oauth-scopes"]?.length,
            `${method} ${path} must declare its bearer scope`,
          ).toBeGreaterThan(0);
        }
        if (path.startsWith("/api/admin/"))
          expect(operation.security, path).toEqual([{ sessionCookie: [] }]);
        if (path.startsWith("/api/ingestion/"))
          expect(operation.security, path).toEqual([
            { publicationIngestionSecret: [] },
          ]);
        if (path === "/api/mcp" && ["post", "delete"].includes(method))
          expect(operation.security).toEqual([{}, { mcpBearerAuth: [] }]);
        if (path.startsWith("/api/calendar-feeds/"))
          expect(operation.security).toEqual([
            { sessionCookie: [] },
            { calendarFeedToken: [] },
          ]);
        if (operation.security?.some((entry) => "bearerAuth" in entry)) {
          bearerOperations++;
          const scopes = operation["x-oauth-scopes"];
          expect(scopes?.length, `${method} ${path}`).toBeGreaterThan(0);
          expect(scopes?.every(isFeatureScope), `${method} ${path}`).toBe(true);
          expect(operation.security, path).toEqual(
            path === "/api/account/client-activity"
              ? [{ bearerAuth: [] }]
              : [{ bearerAuth: [] }, { sessionCookie: [] }],
          );
        }
      }
    }
    expect(bearerOperations).toBeGreaterThan(40);
    expect(
      doc.paths?.["/api/workspace/subscriptions/current"]?.get,
    ).toMatchObject({
      "x-oauth-scopes": ["workspace.subscription:read"],
      "x-oauth-optional-scopes": ["workspace.calendar-feed:read"],
    });
    expect(doc.paths?.["/api/workspace/todos"]?.get).toHaveProperty(
      "x-oauth-scopes",
      ["workspace.todo:read"],
    );
    expect(
      doc.paths?.["/api/workspace/subscriptions/query"]?.post,
    ).toHaveProperty("x-oauth-scopes", ["workspace.subscription:read"]);
  });

  it("returns a document with the generated metadata", () => {
    expect(doc.openapi).toBe("3.0.0");
    expect(doc.info.title).toBe("Life@USTC API");
    expect(doc.info.version).toBe("1.0.0");
    expect(doc.info.description).toBe(
      "OpenAPI document generated from SvelteKit route handlers",
    );
    expect(doc.servers).toEqual([{ url: "/", description: "Current origin" }]);
    expect(doc.components?.securitySchemes).toBeDefined();
    expect(doc.components?.schemas).toBeDefined();
  });

  it("publishes the protected paginated workspace exam capability", () => {
    const operation = doc.paths?.["/api/workspace/exams"]?.get;
    expect(operation).toMatchObject({
      operationId: "workspace_exam_list",
      tags: ["workspace.exam"],
      security: [{ bearerAuth: [] }, { sessionCookie: [] }],
    });
    expect(
      operation?.parameters?.map((parameter) =>
        "name" in parameter ? parameter.name : undefined,
      ),
    ).toEqual([
      "dateFrom",
      "dateTo",
      "includeDateUnknown",
      "semesterId",
      "page",
      "pageSize",
      "locale",
    ]);
    expect(operation?.responses).toHaveProperty("200");
    expect(operation?.responses).toHaveProperty("401");
    expect(operation?.responses).toHaveProperty("403");
  });

  it("publishes pageSize without the removed pagination limit alias", () => {
    const paths = doc.paths as Record<
      string,
      {
        get?: {
          parameters?: Array<{
            deprecated?: boolean;
            description?: string;
            name?: string;
          }>;
        };
      }
    >;

    for (const path of [
      "/api/catalog/courses",
      "/api/catalog/sections",
      "/api/catalog/schedules",
      "/api/catalog/teachers",
      "/api/catalog/semesters",
      "/api/community/comments",
      "/api/workspace/uploads",
      "/api/admin/users",
      "/api/admin/comments",
      "/api/admin/homeworks",
      "/api/admin/descriptions",
    ]) {
      const parameters = paths[path]?.get?.parameters ?? [];
      const pageSize = parameters.find((parameter) => {
        return parameter.name === "pageSize";
      });
      const limit = parameters.find((parameter) => {
        return parameter.name === "limit";
      });

      expect(pageSize, path).toBeDefined();
      expect(pageSize?.deprecated, path).not.toBe(true);
      expect(limit, path).toBeUndefined();
    }
  });

  it("publishes true creates as 201 responses with Location", () => {
    const paths = doc.paths as Record<
      string,
      {
        post?: {
          responses?: Record<string, { headers?: Record<string, unknown> }>;
        };
      }
    >;

    for (const path of [
      "/api/workspace/todos",
      "/api/community/comments",
      "/api/community/section-homeworks",
      "/api/admin/suspensions",
    ]) {
      const responses = paths[path]?.post?.responses;
      expect(responses?.["200"], path).toBeUndefined();
      expect(responses?.["201"]?.headers, path).toHaveProperty("Location");
    }

    expect(
      paths["/api/community/descriptions"]?.post?.responses?.["200"],
    ).toBeDefined();
  });
});
