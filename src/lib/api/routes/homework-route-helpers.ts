import {
  badRequest,
  notFound,
  parseInteger,
  parseRouteInput,
} from "@/lib/api/helpers";
import { resourceIdPathParamsSchema } from "@/lib/api/schemas/request-schemas";
import { prisma } from "@/lib/db/prisma";

type IdParams = { id: string };

export function parseHomeworkId(params: IdParams) {
  const parsedParams = parseRouteInput(
    params,
    resourceIdPathParamsSchema,
    "Invalid homework ID",
  );
  return parsedParams instanceof Response ? parsedParams : parsedParams.id;
}

export async function resolveHomeworkSectionIds(input: {
  sectionId?: string;
  sectionIds?: string;
  sectionJwId?: string;
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
  if (input.sectionJwId) {
    const jwId = parseInteger(input.sectionJwId);
    if (jwId) {
      const section = await prisma.section.findUnique({
        where: { jwId },
        select: { id: true },
      });
      if (!section) return notFound("Section not found");
      sectionIdList.push(section.id);
    }
  }

  return sectionIdList.length > 0
    ? sectionIdList
    : badRequest(
        "Invalid section - provide sectionId, sectionIds, or sectionJwId",
      );
}
