import { requireDemoApiScope } from "@/features/demo/server/demo-api-auth";
import { getDemoSessionAuditId } from "@/features/demo/server/demo-auth";
import {
  getDemoTodos,
  simulateDemoTodoCreate,
} from "@/features/demo/server/demo-fixtures";
import { badRequest, jsonResponse } from "@/lib/api/responses";
import { apiRequestContext } from "@/lib/log/api-observability-context";
import { logAppEvent } from "@/lib/log/app-logger";
import type { RequestHandler } from "./$types";

/**
 * List the immutable demo todo fixture.
 * @response demoTodosResponseSchema
 * @response 401:openApiErrorSchema
 * @response 403:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = async ({ request }) => {
  const principal = await requireDemoApiScope(request, "demo:todo:read");
  if (principal instanceof Response) return principal;
  return jsonResponse(
    { fixture: true, todos: getDemoTodos(principal) },
    { headers: { "Cache-Control": "no-store" } },
  );
};

/**
 * Simulate creating a demo todo without persistence.
 * @body demoTodoCreateRequestSchema
 * @response demoTodoCreateResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 403:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const POST: RequestHandler = async ({ request }) => {
  const principal = await requireDemoApiScope(request, "demo:todo:write");
  if (principal instanceof Response) return principal;
  const body = (await request.json().catch(() => null)) as {
    title?: unknown;
  } | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 200) {
    return badRequest("invalid_title");
  }
  logAppEvent("info", "demo mutation simulated", {
    event: "demo.mutation.simulated",
    fixtureVersion: principal.fixtureVersion,
    operation: "todo.create",
    requestId: apiRequestContext(request).requestId,
    sessionHash: getDemoSessionAuditId(principal.sessionId),
  });
  return jsonResponse(simulateDemoTodoCreate(principal, title), {
    headers: {
      "Cache-Control": "no-store",
      "x-life-ustc-simulated": "true",
    },
  });
};
