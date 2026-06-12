import { prisma } from "@/lib/db/prisma";
import type {
  BusPreferencePayload,
  BusUserPreferenceSummary,
} from "./bus-types";

export async function getBusPreference(
  userId: string | null,
): Promise<BusUserPreferenceSummary | null> {
  if (!userId) return null;

  const preference = await prisma.busUserPreference.findUnique({
    where: { userId },
  });

  if (!preference) {
    return {
      preferredOriginCampusId: null,
      preferredDestinationCampusId: null,
      showDepartedTrips: false,
    };
  }

  return {
    preferredOriginCampusId: preference.preferredOriginCampusId,
    preferredDestinationCampusId: preference.preferredDestinationCampusId,
    showDepartedTrips: preference.showDepartedTrips,
  };
}

export async function saveBusPreference(
  userId: string,
  payload: BusPreferencePayload,
) {
  const data = {
    preferredOriginCampusId: payload.preferredOriginCampusId,
    preferredDestinationCampusId: payload.preferredDestinationCampusId,
    favoriteCampusIds: [] as number[],
    favoriteRouteIds: [] as number[],
    showDepartedTrips: payload.showDepartedTrips,
  };

  await prisma.busUserPreference.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  return { ...data } satisfies BusUserPreferenceSummary;
}
