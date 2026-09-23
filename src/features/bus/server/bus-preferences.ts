import { prisma, withUserDbContext } from "@/lib/db/prisma";
import type {
  BusPreferencePayload,
  BusUserPreferenceSummary,
} from "../lib/bus-types";

type SaveBusPreferenceResult =
  | { ok: true; preference: BusUserPreferenceSummary }
  | { ok: false; error: string };

export async function getBusPreference(
  userId: string | null,
): Promise<BusUserPreferenceSummary | null> {
  if (!userId) return null;
  userId = userId.trim();
  if (!userId) return null;

  const preference = await withUserDbContext(userId, (tx) =>
    tx.busUserPreference.findUnique({ where: { userId } }),
  );

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
): Promise<SaveBusPreferenceResult> {
  userId = userId.trim();
  if (!userId) throw new Error("Bus preference user ID is required");
  const validationError = await validatePreferredBusCampuses(payload);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const data = {
    preferredOriginCampusId: payload.preferredOriginCampusId,
    preferredDestinationCampusId: payload.preferredDestinationCampusId,
    favoriteCampusIds: [] as number[],
    favoriteRouteIds: [] as number[],
    showDepartedTrips: payload.showDepartedTrips,
  };

  await withUserDbContext(userId, (tx) =>
    tx.busUserPreference.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    }),
  );

  return {
    ok: true,
    preference: { ...data } satisfies BusUserPreferenceSummary,
  };
}

async function validatePreferredBusCampuses(payload: BusPreferencePayload) {
  const campusIds = Array.from(
    new Set(
      [
        payload.preferredOriginCampusId,
        payload.preferredDestinationCampusId,
      ].filter((id): id is number => id !== null),
    ),
  );

  if (campusIds.length === 0) return null;

  const campuses = await prisma.busCampus.findMany({
    where: { id: { in: campusIds } },
    select: { id: true },
  });
  const knownCampusIds = new Set(campuses.map((campus) => campus.id));

  if (
    payload.preferredOriginCampusId !== null &&
    !knownCampusIds.has(payload.preferredOriginCampusId)
  ) {
    return "Unknown preferred origin campus";
  }

  if (
    payload.preferredDestinationCampusId !== null &&
    !knownCampusIds.has(payload.preferredDestinationCampusId)
  ) {
    return "Unknown preferred destination campus";
  }

  return null;
}
