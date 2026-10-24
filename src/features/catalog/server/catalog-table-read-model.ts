import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";
import { buildPaginatedResponse, normalizePagination } from "@/lib/pagination";
import {
  courseInclude,
  sectionSummarySelect,
  teacherPublicListSelect,
} from "./academic-query-includes";
import {
  toCourseDto,
  toSectionSummaryDto,
  toTeacherListDto,
} from "./academic-summary-dto-mappers";
import { cachedCatalogListRead } from "./catalog-list-cache";
import {
  buildCatalogTableQuery,
  type CatalogTableFilters,
  type CatalogTableKind,
} from "./catalog-table-query";

type TableListInput = {
  filters: CatalogTableFilters;
  locale?: AppLocale;
  pagination: { page: number; pageSize: number };
};

async function listTableRows<T extends { id: number }>(
  kind: CatalogTableKind,
  {
    filters: input,
    locale = DEFAULT_LOCALE,
    pagination: requested,
  }: TableListInput,
  readRows: (ids: number[], locale: AppLocale) => Promise<T[]>,
) {
  const { filters, id, from, where, orderBy } = buildCatalogTableQuery(
    kind,
    input,
  );
  const pagination = normalizePagination(requested);
  return cachedCatalogListRead({
    filters,
    kind,
    locale,
    pagination,
    shape: "web-table-v1",
    load: async () => {
      const prisma = getPrisma(locale);
      const [ids, counts] = await Promise.all([
        prisma.$queryRaw<
          { id: number }[]
        >`SELECT ${id} AS "id" FROM ${from} WHERE ${where} ORDER BY ${orderBy} LIMIT ${pagination.pageSize} OFFSET ${pagination.skip}`,
        prisma.$queryRaw<
          { total: bigint }[]
        >`SELECT COUNT(*) AS "total" FROM ${from} WHERE ${where}`,
      ]);
      const rows = ids.length
        ? await readRows(
            ids.map((row) => row.id),
            locale,
          )
        : [];
      const byId = new Map(rows.map((row) => [row.id, row]));
      const data = ids.flatMap(({ id }) => {
        const row = byId.get(id);
        return row ? [row] : [];
      });
      return buildPaginatedResponse(
        data,
        pagination.page,
        pagination.pageSize,
        Number(counts[0].total),
      );
    },
  });
}

export function listCourseTableSummaries(input: TableListInput) {
  return listTableRows("courses", input, async (ids, locale) => {
    const rows = await getPrisma(locale).course.findMany({
      where: { id: { in: ids } },
      include: courseInclude,
    });
    return rows.map((row) => toCourseDto(row, locale));
  });
}

export function listTeacherTableSummaries(input: TableListInput) {
  return listTableRows("teachers", input, async (ids, locale) => {
    const rows = await getPrisma(locale).teacher.findMany({
      where: { id: { in: ids } },
      select: teacherPublicListSelect,
    });
    return rows.map((row) => toTeacherListDto(row, locale));
  });
}

export function listSectionTableSummaries(input: TableListInput) {
  return listTableRows("sections", input, async (ids, locale) => {
    const rows = await getPrisma(locale).section.findMany({
      where: { id: { in: ids } },
      select: sectionSummarySelect,
    });
    return rows.map((row) => toSectionSummaryDto(row, locale));
  });
}
