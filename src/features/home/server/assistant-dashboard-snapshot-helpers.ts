import {
  getBusPreference,
  getNextBusDepartures,
} from "@/features/bus/lib/bus-service";
import type { AppLocale } from "@/i18n/config";
import type { getPrisma } from "@/lib/db/prisma";

type LocalizedPrisma = ReturnType<typeof getPrisma>;

export function isUpcomingEventAt(value: string | null | undefined, now: Date) {
  if (!value) return false;
  const timestamp = new Date(value);
  return (
    !Number.isNaN(timestamp.getTime()) && timestamp.getTime() >= now.getTime()
  );
}

export function serializeAssistantSemester(
  semester: {
    code: string;
    endDate: Date | null;
    id: number;
    jwId: number;
    nameCn: string;
    startDate: Date | null;
  } | null,
) {
  return semester
    ? {
        id: semester.id,
        jwId: semester.jwId,
        code: semester.code,
        nameCn: semester.nameCn,
        startDate: semester.startDate,
        endDate: semester.endDate,
      }
    : null;
}

export async function listAssistantCurrentSemesterSections({
  currentSemesterId,
  localizedPrisma,
  sectionIds,
}: {
  currentSemesterId: number | null;
  localizedPrisma: LocalizedPrisma;
  sectionIds: number[];
}) {
  return currentSemesterId && sectionIds.length > 0
    ? localizedPrisma.section.findMany({
        where: {
          id: { in: sectionIds },
          semesterId: currentSemesterId,
        },
        orderBy: [{ code: "asc" }],
        select: {
          id: true,
          jwId: true,
          code: true,
          course: {
            select: {
              jwId: true,
              code: true,
              namePrimary: true,
              nameSecondary: true,
            },
          },
          semester: {
            select: {
              id: true,
              jwId: true,
              code: true,
              nameCn: true,
            },
          },
          campus: {
            select: {
              id: true,
              namePrimary: true,
              nameSecondary: true,
            },
          },
          teachers: {
            select: {
              id: true,
              namePrimary: true,
              nameSecondary: true,
            },
            orderBy: [{ nameCn: "asc" }],
          },
        },
      })
    : Promise.resolve([]);
}

export async function resolveAssistantBusSnapshot(input: {
  locale: AppLocale;
  now: Date;
  userId: string;
}) {
  const preference = await getBusPreference(input.userId);
  const nextBus =
    preference?.preferredOriginCampusId != null &&
    preference?.preferredDestinationCampusId != null
      ? await getNextBusDepartures({
          locale: input.locale,
          originCampusId: preference.preferredOriginCampusId,
          destinationCampusId: preference.preferredDestinationCampusId,
          atTime: input.now.toISOString(),
          includeDeparted: preference.showDepartedTrips,
          limit: 3,
          userId: input.userId,
        })
      : null;
  const nextDeparture =
    nextBus?.departures.find((departure) => departure.status === "upcoming") ??
    null;

  return {
    preference,
    nextDeparture,
    departures: nextBus?.departures ?? [],
  };
}
