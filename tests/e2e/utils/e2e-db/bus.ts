import { withE2ePrisma } from "./prisma";

export type BusTripTimesSnapshot = Array<{
  id: number;
  stopTimes: Array<string | null>;
}>;

export async function isolateSingleActiveBusTripFixture(
  stopTimes: [string, string],
): Promise<BusTripTimesSnapshot> {
  return await withE2ePrisma(async (prisma) => {
    const trips = await prisma.busTrip.findMany({
      orderBy: [{ dayType: "asc" }, { position: "asc" }],
      select: { dayType: true, id: true, stopTimes: true },
    });
    const firstTripIds = new Set(
      ["weekday", "weekend"].flatMap((dayType) => {
        const trip = trips.find((candidate) => candidate.dayType === dayType);
        return trip ? [trip.id] : [];
      }),
    );

    await prisma.$transaction(
      trips.map((trip) =>
        prisma.busTrip.update({
          where: { id: trip.id },
          data: {
            stopTimes: firstTripIds.has(trip.id) ? stopTimes : [],
          },
        }),
      ),
    );

    return trips.map((trip) => ({
      id: trip.id,
      stopTimes: trip.stopTimes as Array<string | null>,
    }));
  });
}

export async function restoreBusTripTimesFixture(
  snapshot: BusTripTimesSnapshot,
) {
  await withE2ePrisma(async (prisma) => {
    await prisma.$transaction(
      snapshot.map((trip) =>
        prisma.busTrip.update({
          where: { id: trip.id },
          data: { stopTimes: trip.stopTimes },
        }),
      ),
    );
  });
}
