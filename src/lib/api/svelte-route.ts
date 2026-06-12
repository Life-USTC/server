import type { RequestEvent, RequestHandler } from "@sveltejs/kit";

type RequestOnlyHandler = (request: Request) => Response | Promise<Response>;

export function svelteRequestHandler(
  handler: RequestOnlyHandler,
): RequestHandler {
  return (event: RequestEvent) => handler(event.request);
}
