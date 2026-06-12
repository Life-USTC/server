import { parseRouteJsonBody, parseRouteSearchParams } from "@/lib/api/helpers";
import {
  todoCreateRequestSchema,
  todosQuerySchema,
  todoUpdateRequestSchema,
} from "@/lib/api/schemas/request-schemas";

export function parseTodosQuery(request: Request) {
  const { searchParams } = new URL(request.url);
  return parseRouteSearchParams(
    searchParams,
    todosQuerySchema,
    "Invalid todo query",
    { logErrors: true },
  );
}

export function parseTodoCreateBody(request: Request) {
  return parseRouteJsonBody(
    request,
    todoCreateRequestSchema,
    "Invalid todo request",
  );
}

export function parseTodoUpdateBody(request: Request) {
  return parseRouteJsonBody(
    request,
    todoUpdateRequestSchema,
    "Invalid todo update",
  );
}
