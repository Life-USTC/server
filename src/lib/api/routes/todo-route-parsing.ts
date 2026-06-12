import { parseRouteInput } from "@/lib/api/helpers";
import { resourceIdPathParamsSchema } from "@/lib/api/schemas/request-schemas";

export type TodoIdParams = { id: string };

export function parseTodoIdParams(params: TodoIdParams) {
  const parsedParams = parseRouteInput(
    params,
    resourceIdPathParamsSchema,
    "Invalid todo ID",
  );
  if (parsedParams instanceof Response) {
    return parsedParams;
  }
  return parsedParams.id;
}
