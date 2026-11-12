import { error } from "@sveltejs/kit";
import { getOpenApiRoute } from "@/lib/api/routes/openapi";
import {
  isKnownApiDocsPath,
  type OpenApiDocument,
} from "../lib/docs-navigation";

/** Read the current built specification through the actual local assets binding. */
export async function loadDemoApiDocsDocument(
  request: Request,
): Promise<OpenApiDocument> {
  const response = await getOpenApiRoute(
    new Request(request, { method: "GET" }),
    true,
  );
  if (!response.ok) error(503, "Local API specification unavailable");
  const document: unknown = await response.json();
  if (
    !document ||
    typeof document !== "object" ||
    !("paths" in document) ||
    !("openapi" in document) ||
    !("info" in document)
  )
    error(503, "Invalid local API specification");
  // The existing contract has one static same-origin server. Do not expose a
  // newly interactive/external server configuration without reviewing it.
  if (
    !("servers" in document) ||
    !Array.isArray(document.servers) ||
    document.servers.length !== 1 ||
    !document.servers[0] ||
    typeof document.servers[0] !== "object" ||
    document.servers[0].url !== "/" ||
    "variables" in document.servers[0]
  )
    error(503, "Unsupported local API server configuration");
  return document as OpenApiDocument;
}
export async function requireDemoApiDocsPath(
  request: Request,
  pathname: string,
) {
  const document = await loadDemoApiDocsDocument(request);
  if (!isKnownApiDocsPath(document, pathname))
    error(404, "API documentation not found");
}
