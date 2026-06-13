import type { BusImportPrisma } from "./bus-import-prisma";
import { buildBusScheduleVersionData } from "./bus-import-version-data";
import type { BusStaticPayload } from "./bus-types";

export async function findExistingBusScheduleVersion(
  prisma: BusImportPrisma,
  {
    checksum,
    versionKey,
  }: {
    checksum: string;
    versionKey: string;
  },
) {
  return prisma.busScheduleVersion.findFirst({
    where: {
      OR: [{ key: versionKey }, { checksum }],
    },
    select: { id: true },
  });
}

export async function refreshExistingBusScheduleVersion(
  prisma: BusImportPrisma,
  {
    checksum,
    effectiveFrom,
    effectiveUntil,
    existingId,
    payload,
    versionKey,
    versionTitle,
  }: {
    checksum: string;
    effectiveFrom: Date | null;
    effectiveUntil: Date | null;
    existingId: number;
    payload: BusStaticPayload;
    versionKey: string;
    versionTitle: string;
  },
) {
  await prisma.busTrip.deleteMany({ where: { versionId: existingId } });
  await prisma.busScheduleVersion.update({
    where: { id: existingId },
    data: buildBusScheduleVersionData({
      checksum,
      effectiveFrom,
      effectiveUntil,
      payload,
      versionKey,
      versionTitle,
    }),
  });
}

export async function disablePreviousBusScheduleVersions(
  prisma: BusImportPrisma,
  {
    existingId,
    versionKey,
  }: {
    existingId?: number;
    versionKey: string;
  },
) {
  await prisma.busScheduleVersion.updateMany({
    where: existingId
      ? { id: { not: existingId } }
      : { key: { not: versionKey } },
    data: { isEnabled: false },
  });
}

export function upsertImportedBusScheduleVersion(
  prisma: BusImportPrisma,
  {
    checksum,
    effectiveFrom,
    effectiveUntil,
    existingId,
    payload,
    versionKey,
    versionTitle,
  }: {
    checksum: string;
    effectiveFrom: Date | null;
    effectiveUntil: Date | null;
    existingId?: number;
    payload: BusStaticPayload;
    versionKey: string;
    versionTitle: string;
  },
) {
  return existingId != null
    ? prisma.busScheduleVersion.update({
        where: { id: existingId },
        data: {
          importedAt: new Date(),
        },
        select: { id: true, key: true },
      })
    : prisma.busScheduleVersion.create({
        data: buildBusScheduleVersionData({
          checksum,
          effectiveFrom,
          effectiveUntil,
          payload,
          versionKey,
          versionTitle,
        }),
        select: { id: true, key: true },
      });
}
