import {
  getMessages,
  optionalValue,
  PAGE_SIZE,
  parsePositivePage,
  toLoadData,
} from "@/lib/page-data-utils";

export async function getSectionListPage(url: URL, locale = "zh-cn") {
  const [
    { buildSectionListQuery },
    { paginatedSectionSummaryQuery },
    { getPrisma },
  ] = await Promise.all([
    import("@/lib/course-section-queries"),
    import("@/lib/query-helpers"),
    import("@/lib/db/prisma"),
  ]);
  const page = parsePositivePage(url.searchParams.get("page"));
  const search = optionalValue(url.searchParams.get("search"));
  const semesterId = optionalValue(url.searchParams.get("semesterId"));
  const { where, orderBy } = buildSectionListQuery({ semesterId, search });
  const prisma = getPrisma(locale);

  const [result, semesters, messages] = await Promise.all([
    paginatedSectionSummaryQuery(
      page,
      PAGE_SIZE,
      where,
      orderBy ?? { semester: { jwId: "desc" as const } },
      locale,
    ),
    prisma.semester.findMany({
      select: { id: true, nameCn: true },
      take: 100,
      orderBy: { jwId: "desc" },
    }),
    getMessages(locale),
  ]);

  return toLoadData({
    ...result,
    filters: { search, semesterId },
    filterOptions: { semesters },
    labels: {
      common: messages.common,
      sections: {
        ...messages.sections,
        close: messages.sectionDetail.close,
      },
    },
  });
}
