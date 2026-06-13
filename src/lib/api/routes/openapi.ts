import { handleRouteError, jsonResponse } from "@/lib/api/helpers";
import openApiSpec from "../../../../public/openapi.generated.json";

export async function getOpenApiRoute() {
  try {
    return jsonResponse(openApiSpec);
  } catch (error) {
    return handleRouteError("Failed to read generated OpenAPI document", error);
  }
}
