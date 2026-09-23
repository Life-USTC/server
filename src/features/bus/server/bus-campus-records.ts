import type { AppLocale } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";
import { normalizeBusCampusCoordinates } from "../lib/bus-import-route-data";

export async function getBusCampuses(locale: AppLocale) {
  const localizedPrisma = getPrisma(locale);
  const campuses = await localizedPrisma.busCampus.findMany({
    orderBy: { id: "asc" },
  });

  return campuses.map((campus) => {
    const { latitude, longitude } = normalizeBusCampusCoordinates(campus);
    return {
      id: campus.id,
      nameCn: campus.nameCn,
      nameEn: campus.nameEn,
      namePrimary: campus.namePrimary,
      nameSecondary: campus.nameSecondary,
      latitude,
      longitude,
    };
  });
}
