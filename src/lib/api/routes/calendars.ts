import { handleRouteError } from "@/lib/api/helpers";
import {
  generateSectionCalendarAction,
  generateSectionsCalendarAction,
  generateUserCalendarAction,
} from "./calendar-route-actions";
import {
  parseSectionCalendarJwId,
  parseSectionsCalendarIds,
  parseUserCalendarRawUserId,
} from "./calendar-route-request";
import { resolveUserCalendarAccess } from "./calendar-route-user-access";

export async function getSectionsCalendarRoute(request: Request) {
  try {
    const sectionIds = parseSectionsCalendarIds(request);
    if (sectionIds instanceof Response) {
      return sectionIds;
    }

    return await generateSectionsCalendarAction(sectionIds);
  } catch (error) {
    return handleRouteError("Failed to generate calendar", error);
  }
}

export async function getSectionCalendarRoute(params: { jwId: string }) {
  try {
    const sectionJwId = parseSectionCalendarJwId(params);
    if (sectionJwId instanceof Response) {
      return sectionJwId;
    }

    return await generateSectionCalendarAction(sectionJwId);
  } catch (error) {
    return handleRouteError("Failed to generate calendar", error);
  }
}

export async function getUserCalendarRoute(
  request: Request,
  params: { userId: string },
) {
  try {
    const rawUserId = parseUserCalendarRawUserId(params);
    if (rawUserId instanceof Response) {
      return rawUserId;
    }
    const access = await resolveUserCalendarAccess({ rawUserId, request });
    if (!access.ok) {
      return access.response;
    }

    return await generateUserCalendarAction(access.user, access.userId);
  } catch (error) {
    return handleRouteError("Failed to generate user calendar", error);
  }
}
