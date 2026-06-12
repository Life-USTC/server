import {
  mcpDeleteRoute,
  mcpGetRoute,
  mcpOptionsRoute,
  mcpPostRoute,
} from "@/lib/api/routes/mcp";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = ({ request }) => mcpGetRoute(request);
export const POST: RequestHandler = ({ request }) => mcpPostRoute(request);
export const DELETE: RequestHandler = ({ request }) => mcpDeleteRoute(request);
export const OPTIONS: RequestHandler = ({ request }) =>
  mcpOptionsRoute(request);
