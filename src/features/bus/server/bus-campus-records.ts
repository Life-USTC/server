import type { AppLocale } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";

export async function getBusCampuses(locale: AppLocale) {
  const localizedPrisma = getPrisma(locale);
  const campuses = await localizedPrisma.busCampus.findMany({
    orderBy: { id: "asc" },
  });

  return campuses.map((campus) => ({
    id: campus.id,
    nameCn: campus.nameCn,
    nameEn: campus.nameEn,
    namePrimary: campus.namePrimary,
    nameSecondary: campus.nameSecondary,
    latitude: campus.latitude,
    longitude: campus.longitude,
  }));
}
