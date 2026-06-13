import { DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";
import {
  type SectionOption,
  sectionOptionFromRow,
  withSubscribedSections,
} from "./subscription-read-model-shared";

export async function listSubscribedSectionOptions(
  userId: string,
  locale = DEFAULT_LOCALE,
  options: { sectionIds?: readonly number[] } = {},
): Promise<SectionOption[]> {
  return withSubscribedSections(
    userId,
    async (ids) => {
      const sections = await getPrisma(locale).section.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          jwId: true,
          code: true,
          course: { select: { namePrimary: true } },
          semester: {
            select: { nameCn: true, startDate: true, endDate: true },
          },
        },
        orderBy: [{ semester: { jwId: "desc" } }, { code: "asc" }],
      });
      return sections.map(sectionOptionFromRow);
    },
    options.sectionIds,
  );
}
