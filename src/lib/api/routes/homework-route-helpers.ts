import { badRequest, parseInteger, parseRouteInput } from "@/lib/api/helpers";
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

export function parseHomeworkSectionIds(input: {
  sectionId?: string;
  sectionIds?: string;
}) {
  const sectionIdList: number[] = [];
  if (input.sectionIds) {
    for (const value of input.sectionIds.split(",")) {
      const id = parseInteger(value.trim());
      if (id) sectionIdList.push(id);
    }
  } else if (input.sectionId) {
    const id = parseInteger(input.sectionId);
    if (id) sectionIdList.push(id);
  }

  return sectionIdList.length > 0
    ? sectionIdList
    : badRequest("Invalid section - provide sectionId or sectionIds");
}
