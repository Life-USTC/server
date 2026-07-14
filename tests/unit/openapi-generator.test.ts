import { describe, expect, it } from "vitest";
import { generateOpenApiDocument } from "../../scripts/openapi/generate";

describe("openapi generator", () => {
  it("returns a document with the generated metadata", () => {
    const doc = generateOpenApiDocument();
    expect(doc.openapi).toBe("3.0.0");
    expect(doc.info.title).toBe("Life@USTC API");
    expect(doc.info.version).toBe("1.0.0");
    expect(doc.info.description).toBe(
      "OpenAPI document generated from SvelteKit route handlers",
    );
    expect(doc.servers).toEqual([{ url: "/", description: "Current origin" }]);
    expect(doc.components?.securitySchemes).toBeDefined();
    expect(doc.components?.schemas).toBeDefined();
  }, 15_000);

  it("publishes pageSize and marks limit as its deprecated alias", () => {
    const doc = generateOpenApiDocument();
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
      "/api/courses",
      "/api/sections",
      "/api/schedules",
      "/api/teachers",
      "/api/semesters",
      "/api/comments",
      "/api/uploads",
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
      expect(limit?.deprecated, path).toBe(true);
      expect(limit?.description, path).toContain("pageSize");
    }
  }, 15_000);

  it("publishes true creates as 201 responses with Location", () => {
    const doc = generateOpenApiDocument();
    const paths = doc.paths as Record<
      string,
      {
        post?: {
          responses?: Record<string, { headers?: Record<string, unknown> }>;
        };
      }
    >;

    for (const path of [
      "/api/todos",
      "/api/comments",
      "/api/homeworks",
      "/api/admin/suspensions",
    ]) {
      const responses = paths[path]?.post?.responses;
      expect(responses?.["200"], path).toBeUndefined();
      expect(responses?.["201"]?.headers, path).toHaveProperty("Location");
    }

    expect(paths["/api/descriptions"]?.post?.responses?.["200"]).toBeDefined();
  }, 15_000);
});
