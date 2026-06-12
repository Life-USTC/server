import { getPagePrisma } from "@/lib/page-data-utils";
import { getSectionPageRelatedData } from "@/lib/section-page-related-data";
import {
  buildSectionPageLoadData,
  sectionPageSelect,
} from "@/lib/section-page-shape";

export async function getSectionPage(jwId: number, locale = "zh-cn") {
  const prisma = await getPagePrisma(locale);
  const section = await prisma.section.findUnique({
    where: { jwId },
    select: sectionPageSelect,
  });

  if (!section) return null;

  const relatedData = await getSectionPageRelatedData({
    locale,
    prisma,
    section,
  });

  return buildSectionPageLoadData(section, relatedData);
}
