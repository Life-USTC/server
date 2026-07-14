import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import type * as z from "zod";
import { collectPaths } from "../../scripts/openapi/route-collector";
import { SchemaCollector } from "../../scripts/openapi/schema-collector";

describe("SchemaCollector", () => {
  it("registers a schema when referenced by name", () => {
    const schemas = new SchemaCollector();
    const todoList = schemas.lookup("todosListResponseSchema");
    expect(todoList).toBeDefined();

    schemas.register("todosListResponseSchema");
    const registered = schemas.getRegisteredSchemas();
    expect(registered.todosListResponseSchema).toBe(todoList);
  });

  it("returns undefined for unknown schema names", () => {
    const schemas = new SchemaCollector();
    expect(schemas.lookup("unknownSchema")).toBeUndefined();
  });
});

describe("route collector", () => {
  it("builds an operation from JSDoc tags", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile(
      "src/routes/api/todos/+server.ts",
      `
/**
 * List todos.
 * @params todosQuerySchema
 * @response todosListResponseSchema
 * @response 401:openApiErrorSchema
 */
export const GET = () => new Response();
`,
      { overwrite: true },
    );

    const schemas = new SchemaCollector();
    const paths = collectPaths(project, schemas, {
      operationIdOverrides: { "GET /api/todos": "listTodos" },
    });

    expect(paths).toHaveProperty("/api/todos");
    const operation = paths["/api/todos"].get as Record<string, unknown>;
    expect(operation.operationId).toBe("listTodos");
    expect(operation.summary).toBe("List todos");
    expect(operation.tags).toEqual(["Todos"]);
    expect(operation.security).toEqual([
      { bearerAuth: [] },
      { sessionCookie: [] },
    ]);

    const requestParams = operation.requestParams as { query: z.ZodType };
    expect(requestParams.query).toBeDefined();

    const responses = operation.responses as Record<
      string,
      Record<string, unknown>
    >;
    expect(responses["200"].description).toBe("Successful response");
    expect(responses["401"].description).toBe("Error response");
  });

  it("handles response shortcuts", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile(
      "src/routes/api/health/+server.ts",
      `
/**
 * Check health.
 * @response 200:text
 */
export const GET = () => new Response();
`,
      { overwrite: true },
    );

    const schemas = new SchemaCollector();
    const paths = collectPaths(project, schemas);
    const responses = (paths["/api/health"].get as Record<string, unknown>)
      .responses as Record<string, Record<string, unknown>>;

    expect(responses["200"].description).toBe("Text response");
    expect(
      (responses["200"].content as Record<string, unknown>)["text/plain"],
    ).toBeDefined();
  });

  it("documents a relative Location header for 201 responses", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile(
      "src/routes/api/todos/+server.ts",
      `
/**
 * Create a todo.
 * @response 201:idResponseSchema
 */
export const POST = () => new Response();
`,
      { overwrite: true },
    );

    const schemas = new SchemaCollector();
    const paths = collectPaths(project, schemas);
    const responses = (paths["/api/todos"].post as Record<string, unknown>)
      .responses as Record<string, Record<string, unknown>>;

    expect(responses["200"]).toBeUndefined();
    expect(responses["201"].headers).toEqual({
      Location: {
        description: "Relative URL of the created resource",
        schema: { type: "string" },
      },
    });
  });

  it("parses path parameters and request body", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile(
      "src/routes/api/todos/[id]/+server.ts",
      `
/**
 * Update one todo.
 * @pathParams resourceIdPathParamsSchema
 * @body todoUpdateRequestSchema
 * @response todoUpdateResponseSchema
 */
export const PATCH = () => new Response();
`,
      { overwrite: true },
    );

    const schemas = new SchemaCollector();
    const paths = collectPaths(project, schemas, {
      operationIdOverrides: { "PATCH /api/todos/{id}": "updateTodo" },
    });

    const operation = paths["/api/todos/{id}"].patch as Record<string, unknown>;
    expect(operation.operationId).toBe("updateTodo");

    const requestParams = operation.requestParams as { path: z.ZodType };
    expect(requestParams.path).toBeDefined();

    const requestBody = operation.requestBody as Record<string, unknown>;
    expect(requestBody.required).toBe(true);
    const content = requestBody.content as Record<
      string,
      Record<string, unknown>
    >;
    expect(content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/todoUpdateRequestSchema",
    });
  });

  it("collects .well-known routes including nested paths", () => {
    const project = new Project({ useInMemoryFileSystem: true });

    project.createSourceFile(
      "src/routes/.well-known/openid-configuration/+server.ts",
      `
/**
 * OpenID provider metadata.
 * @response 200
 */
export const { GET, OPTIONS } = { GET: () => new Response(), OPTIONS: () => new Response() };
`,
      { overwrite: true },
    );

    project.createSourceFile(
      "src/routes/api/auth/.well-known/openid-configuration/+server.ts",
      `
/**
 * Auth issuer metadata.
 * @response 200
 */
export function GET() {
  return new Response();
}
`,
      { overwrite: true },
    );

    const schemas = new SchemaCollector();
    const paths = collectPaths(project, schemas);

    expect(paths["/.well-known/openid-configuration"]).toBeDefined();
    expect(paths["/.well-known/openid-configuration"].get).toBeDefined();
    expect(paths["/.well-known/openid-configuration"].options).toBeDefined();

    expect(paths["/api/auth/.well-known/openid-configuration"]).toBeDefined();
    expect(
      paths["/api/auth/.well-known/openid-configuration"].get,
    ).toBeDefined();
  });

  it("includes Location header for .well-known 307 redirects", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile(
      "src/routes/.well-known/oauth-authorization-server/+server.ts",
      `
/**
 * Compatibility alias.
 * @response 307
 */
export const { GET, OPTIONS } = { GET: () => new Response(), OPTIONS: () => new Response() };
`,
      { overwrite: true },
    );

    const schemas = new SchemaCollector();
    const paths = collectPaths(project, schemas);
    const operation = paths["/.well-known/oauth-authorization-server"]
      .get as Record<string, unknown>;
    const responses = operation.responses as Record<
      string,
      Record<string, unknown>
    >;

    expect(responses["307"].description).toBe("Redirect");
    const headers = responses["307"].headers as Record<
      string,
      Record<string, unknown>
    >;
    expect(headers.Location).toBeDefined();
    expect(headers.Location.schema).toEqual({ type: "string", format: "uri" });
  });

  it("collects function-declaration handlers", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile(
      "src/routes/api/health/+server.ts",
      `
/**
 * Check process liveness.
 * @response 200:text
 */
export function GET() {
  return new Response("ok");
}
`,
      { overwrite: true },
    );

    const schemas = new SchemaCollector();
    const paths = collectPaths(project, schemas);

    expect(paths["/api/health"]).toBeDefined();
    const operation = paths["/api/health"].get as Record<string, unknown>;
    expect(operation.summary).toBe("Check process liveness");

    const responses = operation.responses as Record<
      string,
      Record<string, unknown>
    >;
    expect(responses["200"].description).toBe("Text response");
    expect(
      (responses["200"].content as Record<string, unknown>)["text/plain"],
    ).toBeDefined();
  });

  it("uses object items for the array response shortcut", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile(
      "src/routes/api/sections/[jwId]/schedules/+server.ts",
      `
/**
 * List section schedules.
 * @response 200:array
 */
export const GET = () => new Response();
`,
      { overwrite: true },
    );

    const schemas = new SchemaCollector();
    const paths = collectPaths(project, schemas);

    const responses = (
      paths["/api/sections/{jwId}/schedules"].get as Record<string, unknown>
    ).responses as Record<string, Record<string, unknown>>;
    const schema = (
      responses["200"].content as Record<string, Record<string, unknown>>
    )["application/json"].schema as Record<string, unknown>;
    expect(schema.type).toBe("array");
    expect(schema.items).toEqual({ type: "object" });
  });
});
