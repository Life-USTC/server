import {
  getSectionScheduleGroupsByJwId,
  getSectionSchedulesByJwId,
} from "@/features/catalog/server/schedule-read-model";
import { jsonResponse, notFound } from "@/lib/api/helpers";

export async function getSectionSchedulesAction(parsedJwId: number) {
  const result = await getSectionSchedulesByJwId({
    sectionJwId: parsedJwId,
  });

  if (!result.found) {
    return notFound("Section not found");
  }

  return jsonResponse(result.schedules);
}

export async function getSectionScheduleGroupsAction(parsedJwId: number) {
  const result = await getSectionScheduleGroupsByJwId({
    sectionJwId: parsedJwId,
  });

  if (!result.found) {
    return notFound("Section not found");
  }

  return jsonResponse(result.scheduleGroups);
}
