import { describe, expect, it } from "vitest";
import openApi from "../../public/openapi.generated.json";

const PROTECTED_MUTATIONS = [
  ["patch", "/api/admin/comments/{id}"],
  ["patch", "/api/admin/descriptions/{id}"],
  ["delete", "/api/admin/homeworks/{id}"],
  ["post", "/api/admin/suspensions"],
  ["patch", "/api/admin/suspensions/{id}"],
  ["patch", "/api/admin/users/{id}"],
  ["post", "/api/bus/preferences"],
  ["post", "/api/calendar-subscriptions"],
  ["patch", "/api/calendar-subscriptions"],
  ["delete", "/api/calendar-subscriptions"],
  ["post", "/api/calendar-subscriptions/batch"],
  ["post", "/api/calendar-subscriptions/import-codes"],
  ["post", "/api/comments"],
  ["patch", "/api/comments/{id}"],
  ["delete", "/api/comments/{id}"],
  ["post", "/api/comments/{id}/reactions"],
  ["delete", "/api/comments/{id}/reactions"],
  ["delete", "/api/comments/batch"],
  ["post", "/api/dashboard-links/pin"],
  ["post", "/api/dashboard-links/pin/batch"],
  ["post", "/api/descriptions"],
  ["post", "/api/homeworks"],
  ["patch", "/api/homeworks/{id}"],
  ["delete", "/api/homeworks/{id}"],
  ["put", "/api/homeworks/{id}/completion"],
  ["put", "/api/homeworks/completions"],
  ["post", "/api/mcp"],
  ["post", "/api/todos"],
  ["patch", "/api/todos/{id}"],
  ["delete", "/api/todos/{id}"],
  ["patch", "/api/todos/batch"],
  ["delete", "/api/todos/batch"],
  ["post", "/api/uploads"],
  ["patch", "/api/uploads/{id}"],
  ["delete", "/api/uploads/{id}"],
  ["post", "/api/uploads/complete"],
  ["put", "/api/uploads/object"],
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
