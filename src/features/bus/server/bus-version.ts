import { prisma } from "@/lib/db/prisma";

export const busVersionRuntimeSelect = {
  id: true,
  key: true,
  title: true,
  sourceMessage: true,
  sourceUrl: true,
  effectiveFrom: true,
  effectiveUntil: true,
  importedAt: true,
} as const;

export type BusVersionRuntime = {
  id: number;
  key: string;
  title: string;
  sourceMessage: string | null;
  sourceUrl: string | null;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
  importedAt: Date;
};

function toDateKey(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function isVersionEffectiveOn(
  version: { effectiveFrom: Date | null; effectiveUntil: Date | null },
  dateKey: string,
) {
  const from = toDateKey(version.effectiveFrom);
  const until = toDateKey(version.effectiveUntil);
  if (from && dateKey < from) return false;
  if (until && dateKey > until) return false;
  return true;
}

export function findEffectiveBusVersionFromRecords(
  versions: BusVersionRuntime[],
  dateKey: string,
) {
  return (
    versions.find((version) => isVersionEffectiveOn(version, dateKey)) ??
    versions[0] ??
    null
  );
}

export async function listEnabledBusVersionRecords() {
  return prisma.busScheduleVersion.findMany({
    where: { isEnabled: true },
    select: busVersionRuntimeSelect,
    orderBy: [
      { effectiveFrom: "desc" },
      { importedAt: "desc" },
      { id: "desc" },
    ],
  });
}

export async function findEffectiveBusVersion(
  dateKey: string,
  versionKey?: string | null,
) {
  if (versionKey) {
    return prisma.busScheduleVersion.findUnique({
      where: { key: versionKey },
      select: busVersionRuntimeSelect,
    });
  }

  const versions = await listEnabledBusVersionRecords();
  return findEffectiveBusVersionFromRecords(versions, dateKey);
}

export function summarizeBusVersions(versions: BusVersionRuntime[]) {
  return versions.map((version) => ({
    id: version.id,
    key: version.key,
    title: version.title,
    effectiveFrom: version.effectiveFrom?.toISOString() ?? null,
    effectiveUntil: version.effectiveUntil?.toISOString() ?? null,
    importedAt: version.importedAt.toISOString(),
    notice:
      version.sourceMessage || version.sourceUrl
        ? {
            message: version.sourceMessage ?? null,
            url: version.sourceUrl ?? null,
          }
        : null,
  }));
}
