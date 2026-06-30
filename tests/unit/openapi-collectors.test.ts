import { describe, expect, it } from "vitest";
import { Project } from "ts-morph";
import * as z from "zod";
import { SchemaCollector } from "../../scripts/openapi/schema-collector";
import { collectPaths } from "../../scripts/openapi/route-collector";

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
    expect(operation.security).toEqual([{ bearerAuth: [] }, { sessionCookie: [] }]);

    const requestParams = operation.requestParams as { query: z.ZodType };
    expect(requestParams.query).toBeDefined();

    const responses = operation.responses as Record<string, Record<string, unknown>>;
    expect(responses["200"].description).toBe("Successful response");
    expect(responses["401"].description).toBe("Error response");
  });

  it("handles response shortcuts", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile(
      "src/routes/api/metrics/+server.ts",
      `
/**
 * Export metrics.
 * @response 200:text
 */
export const GET = () => new Response();
`,
      { overwrite: true },
    );

    const schemas = new SchemaCollector();
    const paths = collectPaths(project, schemas);
    const responses = (paths["/api/metrics"].get as Record<string, unknown>)
      .responses as Record<string, Record<string, unknown>>;

    expect(responses["200"].description).toBe("Text response");
    expect((responses["200"].content as Record<string, unknown>)["text/plain"]).toBeDefined();
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
    const content = requestBody.content as Record<string, Record<string, unknown>>;
    expect(content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/todoUpdateRequestSchema",
    });
  });
});
