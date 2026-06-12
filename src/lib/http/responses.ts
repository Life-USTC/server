import { serializeDatesDeep } from "@/lib/time/serialize-date-output";

export function jsonResponse(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }

  return new Response(JSON.stringify(serializeDatesDeep(body)), {
    ...init,
    headers,
  });
}

export function notFoundText() {
  return new Response("Not found\n", { status: 404 });
}
