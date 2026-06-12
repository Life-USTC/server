import { buildMcpCorsHeaders, validateMcpOrigin } from "./mcp-cors";
import { handleMcpRequest } from "./mcp-request-handler";

export async function mcpGetRoute(request: Request) {
  return handleMcpRequest(request);
}

export async function mcpPostRoute(request: Request) {
  return handleMcpRequest(request);
}

export async function mcpDeleteRoute(request: Request) {
  return handleMcpRequest(request);
}

export function mcpOptionsRoute(request: Request) {
  const originError = validateMcpOrigin(request);
  if (originError) {
    return originError;
  }
  return new Response(null, {
    status: 204,
    headers: buildMcpCorsHeaders(request),
  });
}
