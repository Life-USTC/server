import { resolveHomeworkSectionIds } from "@/features/homeworks/server/homework-list-read-model";
import {
  badRequest,
  notFound,
  parseInteger,
  parseRouteInput,
} from "@/lib/api/helpers";
import { resourceIdPathParamsSchema } from "@/lib/api/schemas/request-schemas";

type IdParams = { id: string };

export function parseHomeworkId(params: IdParams) {
  const parsedParams = parseRouteInput(
    params,
    resourceIdPathParamsSchema,
    "Invalid homework ID",
  );
  return parsedParams instanceof Response ? parsedParams : parsedParams.id;
}

export async function resolveHomeworkRouteSectionIds(input: {
  sectionId?: string;
  sectionIds?: string;
  sectionJwId?: string;
}) {
  const sectionIds: number[] = [];
  if (input.sectionIds) {
    for (const value of input.sectionIds.split(",")) {
      const id = parseInteger(value.trim());
      if (id) sectionIds.push(id);
    }
  }

  const sectionId =
    !input.sectionIds && input.sectionId ? parseInteger(input.sectionId) : null;
  const sectionJwId = input.sectionJwId
    ? parseInteger(input.sectionJwId)
    : null;

  const result = await resolveHomeworkSectionIds({
    sectionId,
    sectionIds,
    sectionJwId,
  });
  if (result.ok) {
    return result.sectionIds;
  }

  return result.error === "not_found"
    ? notFound("Section not found")
    : badRequest(
        "Invalid section - provide sectionId, sectionIds, or sectionJwId",
      );
}
