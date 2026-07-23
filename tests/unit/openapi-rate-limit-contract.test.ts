import { describe, expect, it } from "vitest";
import openApi from "../../public/openapi.generated.json";

const PROTECTED_MUTATIONS = [
  ["patch", "/api/admin/comments/{id}"],
  ["patch", "/api/admin/descriptions/{id}"],
  ["delete", "/api/admin/homeworks/{id}"],
  ["post", "/api/admin/suspensions"],
  ["patch", "/api/admin/suspensions/{id}"],
  ["patch", "/api/admin/users/{id}"],
  ["post", "/api/workspace/bus-preferences"],
  ["post", "/api/workspace/subscriptions"],
  ["patch", "/api/workspace/subscriptions"],
  ["delete", "/api/workspace/subscriptions"],
  ["post", "/api/workspace/subscriptions/batch"],
  ["post", "/api/workspace/subscriptions/import-codes"],
  ["post", "/api/community/comments"],
  ["patch", "/api/community/comments/{id}"],
  ["delete", "/api/community/comments/{id}"],
  ["post", "/api/community/comments/{id}/reactions"],
  ["delete", "/api/community/comments/{id}/reactions"],
  ["delete", "/api/community/comments/batch"],
  ["post", "/api/workspace/link-pins"],
  ["post", "/api/workspace/link-pins/batch"],
  ["post", "/api/community/descriptions"],
  ["post", "/api/community/section-homeworks"],
  ["patch", "/api/community/section-homeworks/{id}"],
  ["delete", "/api/community/section-homeworks/{id}"],
  ["put", "/api/workspace/homeworks/{id}/completion"],
  ["put", "/api/workspace/homeworks/completions"],
  ["post", "/api/mcp"],
  ["post", "/api/workspace/todos"],
  ["patch", "/api/workspace/todos/{id}"],
  ["delete", "/api/workspace/todos/{id}"],
  ["patch", "/api/workspace/todos/batch"],
  ["delete", "/api/workspace/todos/batch"],
  ["post", "/api/workspace/uploads"],
  ["patch", "/api/workspace/uploads/{id}"],
  ["delete", "/api/workspace/uploads/{id}"],
  ["post", "/api/workspace/uploads/complete"],
  ["put", "/api/workspace/uploads/object"],
] as const;

type Operation = {
  responses?: Record<
    string,
    { headers?: Record<string, { schema?: { type?: string } }> }
  >;
};

const paths = openApi.paths as Record<string, Record<string, Operation>>;

describe("OpenAPI mutation rate-limit contract", () => {
  it("documents 429 and fail-closed 503 only on protected mutations", () => {
    const expected = new Set(
      PROTECTED_MUTATIONS.map(([method, path]) => `${method} ${path}`),
    );
    const documented = new Set<string>();

    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        if (!operation.responses?.["429"] && !operation.responses?.["503"]) {
          continue;
        }
        documented.add(`${method} ${path}`);
      }
    }

    expect(documented).toEqual(expected);
  });

  it.each(
    PROTECTED_MUTATIONS,
  )("%s %s exposes Retry-After for both rejection modes", (method, path) => {
    const responses = paths[path]?.[method]?.responses;

    for (const status of ["429", "503"]) {
      expect(
        responses?.[status]?.headers?.["Retry-After"],
        `${method} ${path} ${status}`,
      ).toMatchObject({ schema: { type: "integer" } });
    }
  });
});
