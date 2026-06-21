import { getSectionPageRelatedData } from "@/features/section-detail/server/section-page-related-data";
import {
  buildSectionPageLoadData,
  sectionPageSelect,
} from "@/features/section-detail/server/section-page-shape";
import { getPrisma } from "@/lib/db/prisma";

export async function getSectionPage(jwId: number, locale = "zh-cn") {
  const prisma = getPrisma(locale);
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
