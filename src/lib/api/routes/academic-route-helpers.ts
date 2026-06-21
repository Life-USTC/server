import {
  handleRouteError,
  invalidParamResponse,
  parseInteger,
  parseRouteInput,
} from "@/lib/api/helpers";
import {
  jwIdPathParamsSchema,
  resourceIdPathParamsSchema,
} from "@/lib/api/schemas/request-schemas";
import { parseDateInput } from "@/lib/time/parse-date-input";

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

export function parseScheduleDateParam(
  name: "dateFrom" | "dateTo",
  value?: string,
) {
  if (!value) return undefined;

  const parsed = parseDateInput(value);
  return parsed instanceof Date
    ? parsed
    : handleRouteError("Invalid schedule query", `Invalid ${name}`, 400);
}
