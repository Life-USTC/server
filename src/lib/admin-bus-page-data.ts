import { getPrismaClient, requireAdminPage } from "@/lib/admin-page-auth";
import { toLoadData } from "@/lib/page-data-utils";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";

export async function getAdminBusPage(request: Request) {
  await requireAdminPage(request);
  const prisma = await getPrismaClient();
  const [versions, campusCount, routeCount] = await Promise.all([
    prisma.busScheduleVersion.findMany({
      select: {
        id: true,
        key: true,
        title: true,
        isEnabled: true,
        importedAt: true,
        effectiveFrom: true,
        effectiveUntil: true,
        sourceMessage: true,
        _count: { select: { trips: true } },
      },
      orderBy: { importedAt: "desc" },
    }),
    prisma.busCampus.count(),
    prisma.busRoute.count(),
  ]);

  return toLoadData({
    versions: versions.map((version) => ({
      id: version.id,
      key: version.key,
      title: version.title,
      isEnabled: version.isEnabled,
      sourceMessage: version.sourceMessage,
      tripCount: version._count.trips,
      importedAt: toShanghaiIsoString(version.importedAt),
      effectiveFrom: version.effectiveFrom
        ? toShanghaiIsoString(version.effectiveFrom)
        : null,
      effectiveUntil: version.effectiveUntil
        ? toShanghaiIsoString(version.effectiveUntil)
        : null,
    })),
    summary: {
      versions: versions.length,
      active: versions.find((version) => version.isEnabled)?.title ?? null,
      campuses: campusCount,
      routes: routeCount,
    },
  });
}
