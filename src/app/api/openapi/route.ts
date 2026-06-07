import { readFile } from "node:fs/promises";
import path from "node:path";
import { handleRouteError, jsonResponse } from "@/lib/api/helpers";
import { observedApiRoute } from "@/lib/log/api-observability";

export const dynamic = "force-dynamic";

/**
 * Get generated OpenAPI document.
 * @response openApiDocumentResponseSchema
 */
async function getRoute() {
  try {
    const specPath = path.join(
      process.cwd(),
      "public",
      "openapi.generated.json",
    );
    const spec = await readFile(specPath, "utf-8");

    return jsonResponse(JSON.parse(spec));
  } catch (error) {
    return handleRouteError("Failed to read generated OpenAPI document", error);
  }
}
export const GET = observedApiRoute(getRoute);
