import { handleRouteError } from "@/lib/api/helpers";
import { parseJwIdRouteParam } from "@/lib/api/routes/academic-route-helpers";

export async function withParsedSectionJwId(
  params: { jwId: string },
  errorMessage: string,
  action: (jwId: number) => Promise<Response>,
) {
  try {
    const parsedJwId = parseJwIdRouteParam(params, "section ID");
    if (parsedJwId instanceof Response) return parsedJwId;

    return await action(parsedJwId);
  } catch (error) {
    return handleRouteError(errorMessage, error);
  }
}
