import { buildBusScheduleVersionData } from "../lib/bus-import-version-data";
import type { BusStaticPayload } from "../lib/bus-types";
import type { BusImportWritePrisma } from "./bus-import-prisma";

export async function findExistingBusScheduleVersion(
  prisma: BusImportWritePrisma,
  {
    checksum,
    versionKey,
  }: {
    checksum: string;
    versionKey: string;
  },
) {
  const [byKey, byChecksum] = await Promise.all([
    prisma.busScheduleVersion.findUnique({
      where: { key: versionKey },
      select: { id: true, key: true, checksum: true },
    }),
    prisma.busScheduleVersion.findUnique({
      where: { checksum },
      select: { id: true, key: true, checksum: true },
    }),
  ]);

  if (byKey && byChecksum && byKey.id !== byChecksum.id) {
    throw new Error(
      `Bus schedule version conflict: key "${versionKey}" belongs to version ${byKey.id}, but checksum "${checksum}" belongs to version ${byChecksum.id}`,
    );
  }

  return byKey ?? byChecksum;
}

export async function refreshExistingBusScheduleVersion(
  prisma: BusImportWritePrisma,
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
  prisma: BusImportWritePrisma,
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
  prisma: BusImportWritePrisma,
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
