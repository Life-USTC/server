import { officialAcademicProfileSchema } from "@/features/catalog/lib/official-academic-profile";
import type { AppLocale } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";
import { cachedPublicDetailRuntimeData } from "./catalog-detail-runtime-cache";
import { toOfficialAcademicProfile } from "./official-academic-profile";

export function readOfficialAcademicProfile(
  kind: "course" | "section",
  jwId: number,
  locale: AppLocale,
) {
  return cachedPublicDetailRuntimeData({
    id: jwId,
    kind,
    locale,
    shape: "official-profile-v1",
    validateResult: (value) =>
      officialAcademicProfileSchema.safeParse(value).success,
    load: async () => {
      const prisma = getPrisma(locale);
      const query = {
        where: { jwId },
        select: { officialProfile: true },
      } as const;
      const result =
        kind === "course"
          ? await prisma.course.findUnique(query)
          : await prisma.section.findUnique(query);
      return toOfficialAcademicProfile(result?.officialProfile);
    },
  });
}
