import { json } from "@sveltejs/kit";
import { requireDemoApiScope } from "@/features/demo/server/demo-api-auth";
import { getDemoSessionAuditId } from "@/features/demo/server/demo-auth";
import {
  getDemoTodos,
  simulateDemoTodoCreate,
} from "@/features/demo/server/demo-fixtures";
import { logAppEvent } from "@/lib/log/app-logger";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request }) => {
  const principal = await requireDemoApiScope(request, "demo:todo:read");
  if (principal instanceof Response) return principal;
  return json({ fixture: true, todos: getDemoTodos(principal) });
};

export const POST: RequestHandler = async ({ request }) => {
  const principal = await requireDemoApiScope(request, "demo:todo:write");
  if (principal instanceof Response) return principal;
  const body = (await request.json().catch(() => null)) as {
    title?: unknown;
  } | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 200) {
    return json({ error: "invalid_title" }, { status: 400 });
  }
  logAppEvent("info", "demo mutation simulated", {
    event: "demo.mutation.simulated",
    fixtureVersion: principal.fixtureVersion,
    operation: "todo.create",
    sessionHash: getDemoSessionAuditId(principal.sessionId),
  });
  return json(simulateDemoTodoCreate(principal, title), {
    headers: { "x-life-ustc-simulated": "true" },
  });
};
