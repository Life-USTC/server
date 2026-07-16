import {
  mcpDeleteRoute,
  mcpGetRoute,
  mcpOptionsRoute,
  mcpPostRoute,
} from "@/lib/api/routes/mcp";
import type { RequestHandler } from "./$types";

export const trailingSlash = "ignore";

/**
 * Standalone GET streams are disabled for the stateless MCP transport.
 * @response 405:openApiErrorSchema
 * @response 403:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request }) => mcpGetRoute(request);

/**
 * Send an MCP Streamable HTTP JSON-RPC message.
 * @response 200
 * @response 401:openApiErrorSchema
 * @response 403:openApiErrorSchema
 * @response 429:openApiErrorSchema
 * @response 503:openApiErrorSchema
 */
export const POST: RequestHandler = ({ request }) => mcpPostRoute(request);

/**
 * Close an MCP Streamable HTTP transport session.
 * @response 200
 * @response 401:openApiErrorSchema
 * @response 403:openApiErrorSchema
 */
export const DELETE: RequestHandler = ({ request }) => mcpDeleteRoute(request);

/**
 * Return MCP transport CORS preflight headers.
 * @response 204
 * @response 403:openApiErrorSchema
 */
export const OPTIONS: RequestHandler = ({ request }) =>
  mcpOptionsRoute(request);
