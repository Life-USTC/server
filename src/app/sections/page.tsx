import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ClickableTableRow } from "@/components/clickable-table-row";
import { DataState } from "@/components/data-state";
import {
  MobileList,
  MobileListCard,
  MobileListCardBody,
  MobileListCardDescription,
  MobileListCardMeta,
  MobileListCardTitle,
} from "@/components/mobile-list-card";
import {
  PageBreadcrumbs,
  PageLayout,
  PageMeta,
  PageSection,
} from "@/components/page-layout";
import { PaginationNav } from "@/components/pagination-nav";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseInteger } from "@/lib/api/request-integers";
import { buildSectionListQuery } from "@/lib/course-section-queries";
import { prisma } from "@/lib/db/prisma";
import { buildSearchParams } from "@/lib/navigation/search-params";
import { paginatedSectionQuery } from "@/lib/query-helpers";
import { SectionsFilter } from "./sections-filter";

async function fetchSections(
  page: number,
  semesterId?: string,
  search?: string,
  locale = "zh-cn",
) {
  const { where, orderBy } = buildSectionListQuery({
    semesterId,
    search,
  });

  // Default orderBy if none specified
  const resolvedOrderBy = orderBy ?? { semester: { jwId: "desc" as const } };

  return paginatedSectionQuery(page, undefined, where, resolvedOrderBy, locale);
}

async function fetchSemesters() {
  const semesters = await prisma.semester.findMany({
    select: { id: true, nameCn: true },
    take: 100,
    orderBy: { jwId: "desc" },
  });

  return semesters;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");

  return {
    title: t("pages.sections"),
  };
}

export default async function SectionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    semesterId?: string;
    search?: string;
  }>;
}) {
  const locale = await getLocale();
  const searchP = await searchParams;
  const page = parseInteger(searchP.page) ?? 1;
  const semesterId = searchP.semesterId;
  const search = searchP.search;

  const [data, semesters, t, tCommon] = await Promise.all([
    fetchSections(page, semesterId, search, locale),
    fetchSemesters(),
    getTranslations("sections"),
    getTranslations("common"),
  ]);

  const { data: sections, pagination } = data;
  const { page: currentPage, total, totalPages } = pagination;
  const selectedSemester = semesters.find(
    (s) => s.id.toString() === semesterId,
  );

  const buildUrl = (page: number) => {
    const query = buildSearchParams({
      values: {
        semesterId,
        search,
        page: page > 1 ? String(page) : "",
      },
    });
    return query ? `/sections?${query}` : "/sections";
  };

  return (
    <PageLayout
      title={t("title")}
      description={t("subtitle")}
      breadcrumbs={
        <PageBreadcrumbs
          items={[
            { label: tCommon("home"), href: "/" },
            { label: tCommon("sections") },
          ]}
        />
      }
    >
      <SectionsFilter
        semesters={semesters}
        defaultValues={{ search, semesterId }}
      />

      <PageMeta>
        {t("showing", { count: sections.length, total })}
        {search ? (
          <span className="ml-2">{t("searchFor", { query: search })}</span>
        ) : null}
        {selectedSemester ? (
          <span className="ml-2">
            {t("inSemester", { semester: selectedSemester.nameCn })}
          </span>
        ) : null}
      </PageMeta>

      <PageSection className="overflow-hidden">
        <DataState
          empty={sections.length === 0}
          emptyTitle={t("noSectionsFound")}
          emptyDescription={
            search
              ? t("searchFor", { query: search })
              : selectedSemester
                ? t("inSemester", { semester: selectedSemester.nameCn })
                : null
          }
        >
          <MobileList>
            {sections.map((section) => {
              const teacherNames =
                section.teachers && section.teachers.length > 0
                  ? section.teachers
                      .map((teacher) => teacher.namePrimary)
                      .join(", ")
                  : "—";

              return (
                <MobileListCard
                  key={section.jwId}
                  href={`/sections/${section.jwId}`}
                >
                  <MobileListCardBody>
                    <MobileListCardTitle>
                      {section.course.namePrimary}
                    </MobileListCardTitle>
                    <MobileListCardDescription>
                      {teacherNames}
                    </MobileListCardDescription>
                  </MobileListCardBody>
                  <MobileListCardMeta>
                    {section.semester ? (
                      <Badge variant="outline">{section.semester.nameCn}</Badge>
                    ) : null}
                    <Badge variant="outline" className="font-mono">
                      {section.code}
                    </Badge>
                    <Badge variant="outline">
                      {t("capacity")}: {section.stdCount ?? 0} /{" "}
                      {section.limitCount ?? "—"}
                    </Badge>
                    {section.campus ? (
                      <Badge variant="outline">
                        {section.campus.namePrimary}
                      </Badge>
                    ) : null}
                    {section.credits !== null ? (
                      <Badge variant="secondary">
                        {t("credits")}: {section.credits}
                      </Badge>
                    ) : null}
                  </MobileListCardMeta>
                </MobileListCard>
              );
            })}
          </MobileList>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("semester")}</TableHead>
                  <TableHead>{t("courseName")}</TableHead>
                  <TableHead>{t("sectionCode")}</TableHead>
                  <TableHead>{t("teachers")}</TableHead>
                  <TableHead>{t("credits")}</TableHead>
                  <TableHead>{t("capacity")}</TableHead>
                  <TableHead>{t("campus")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sections.map((section) => (
                  <ClickableTableRow
                    key={section.jwId}
                    href={`/sections/${section.jwId}`}
                  >
                    <TableCell>
                      {section.semester ? (
                        <Badge variant="outline">
                          {section.semester.nameCn}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>{section.course.namePrimary}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {section.code}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div
                        className="max-w-[12ch] truncate"
                        title={
                          section.teachers && section.teachers.length > 0
                            ? section.teachers
                                .map((teacher) => teacher.namePrimary)
                                .join(", ")
                            : undefined
                        }
                      >
                        {section.teachers && section.teachers.length > 0
                          ? section.teachers
                              .map((teacher) => teacher.namePrimary)
                              .join(", ")
                          : "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {section.credits !== null ? section.credits : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {section.stdCount ?? 0} / {section.limitCount ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {section.campus ? section.campus.namePrimary : "—"}
                    </TableCell>
                  </ClickableTableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DataState>
      </PageSection>

      <PaginationNav
        currentPage={currentPage}
        totalPages={totalPages}
        buildUrl={buildUrl}
      />
    </PageLayout>
  );
}
