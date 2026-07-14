import {
  invalidParamResponse,
  parseInteger,
  parseRouteInput,
} from "@/lib/api/helpers";
import {
  jwIdPathParamsSchema,
  resourceIdPathParamsSchema,
} from "@/lib/api/schemas/request-schemas";

export function parseJwIdRouteParam(params: { jwId: string }, label: string) {
  const parsedParams = parseRouteInput(params, jwIdPathParamsSchema, label);
  if (parsedParams instanceof Response) {
    return invalidParamResponse(label);
  }

  const parsedJwId = parseInteger(parsedParams.jwId);
  return parsedJwId === null ? invalidParamResponse(label) : parsedJwId;
}

export function parseResourceIdRouteParam(
  params: { id: string },
  label: string,
) {
  const parsedParams = parseRouteInput(
    params,
    resourceIdPathParamsSchema,
    label,
  );
  if (parsedParams instanceof Response) {
    return invalidParamResponse(label);
  }

  const parsedId = parseInteger(parsedParams.id);
  return parsedId === null ? invalidParamResponse(label) : parsedId;
}
