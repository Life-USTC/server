import { getOpenApiRoute } from "@/lib/api/routes/openapi";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

/**
 * Get OpenAPI document.
 * @response openApiDocumentResponseSchema
 */
export const GET: RequestHandler = ({ request, locals }) =>
  observedApiRoute((request) => getOpenApiRoute(request, Boolean(locals.demo)))(
    request,
  );
