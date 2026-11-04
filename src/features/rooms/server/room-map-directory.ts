import type { AppLocale } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";
import { listRoomMapBuildings } from "./room-map-service";

/** Resolve campus from catalog room identities; do not infer it from room prefixes. */
export async function listRoomMapDirectory(locale: AppLocale) {
  const buildings = await listRoomMapBuildings();
  const codes = buildings.flatMap((building) =>
    building.floors.flatMap((floor) => floor.codes),
  );
  if (codes.length === 0) return buildings;
  const rows = await getPrisma(locale).room.findMany({
    where: { OR: [{ code: { in: codes } }, { nameCn: { in: codes } }] },
    select: {
      code: true,
      nameCn: true,
      building: {
        select: {
          campus: { select: { id: true, nameCn: true, nameEn: true } },
        },
      },
    },
  });
  return buildings.map((building) => {
    const buildingCodes = new Set(
      building.floors.flatMap((floor) => floor.codes),
    );
    const matches = rows.filter(
      (row) =>
        buildingCodes.has(row.code ?? "") ||
        buildingCodes.has(row.nameCn ?? ""),
    );
    const campuses = new Map(
      matches.flatMap((row) =>
        row.building?.campus
          ? [[row.building.campus.id, row.building.campus] as const]
          : [],
      ),
    );
    const campus =
      campuses.size === 1 && matches.every((row) => row.building?.campus)
        ? [...campuses.values()][0]
        : null;
    return {
      ...building,
      campus: campus
        ? locale === "en-us"
          ? campus.nameEn || campus.nameCn
          : campus.nameCn
        : null,
    };
  });
}
