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
import { buildCourseListWhere } from "@/lib/course-section-queries";
import { getPrisma } from "@/lib/db/prisma";
import { buildSearchParams } from "@/lib/navigation/search-params";
import { paginatedCourseQuery } from "@/lib/query-helpers";
import { CoursesFilter } from "./courses-filter";

async function fetchCourses(
  page: number,
  search?: string,
  educationLevelId?: string,
  categoryId?: string,
  classTypeId?: string,
  locale = "zh-cn",
) {
  return paginatedCourseQuery(
    page,
    undefined,
    buildCourseListWhere({
      search,
      educationLevelId,
      categoryId,
      classTypeId,
    }),
    undefined,
    locale,
  );
}

async function fetchFilterOptions(locale: string) {
  const prisma = getPrisma(locale);
  const [educationLevels, categories, classTypes] = await Promise.all([
    prisma.educationLevel.findMany(),
    prisma.courseCategory.findMany(),
    prisma.classType.findMany(),
  ]);
  const toFilterOption = (item: {
    id: number;
    namePrimary: string;
    nameSecondary: string | null;
  }) => ({
    id: item.id,
    namePrimary: item.namePrimary,
    nameSecondary: item.nameSecondary,
  });

  return {
    educationLevels: educationLevels.map(toFilterOption),
    categories: categories.map(toFilterOption),
    classTypes: classTypes.map(toFilterOption),
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");

  return {
    title: t("pages.courses"),
  };
}

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    search?: string;
    educationLevelId?: string;
    categoryId?: string;
    classTypeId?: string;
  }>;
}) {
  const locale = await getLocale();
  const searchP = await searchParams;
  const page = parseInteger(searchP.page) ?? 1;
  const search = searchP.search;
  const educationLevelId = searchP.educationLevelId;
  const categoryId = searchP.categoryId;
  const classTypeId = searchP.classTypeId;

  const [data, filterOptions, t, tCommon] = await Promise.all([
    fetchCourses(
      page,
      search,
      educationLevelId,
      categoryId,
      classTypeId,
      locale,
    ),
    fetchFilterOptions(locale),
    getTranslations("courses"),
    getTranslations("common"),
  ]);
  const { data: courses, pagination } = data;
  const { page: currentPage, total, totalPages } = pagination;
  const { educationLevels, categories, classTypes } = filterOptions;

  const buildUrl = (page: number) => {
    const query = buildSearchParams({
      values: {
        search,
        educationLevelId,
        categoryId,
        classTypeId,
        page: page > 1 ? String(page) : "",
      },
    });
    return query ? `/courses?${query}` : "/courses";
  };

  return (
    <PageLayout
      title={t("title")}
      description={t("subtitle")}
      breadcrumbs={
        <PageBreadcrumbs
          items={[
            { label: tCommon("home"), href: "/" },
            { label: tCommon("courses") },
          ]}
        />
      }
    >
      <CoursesFilter
        educationLevels={educationLevels}
        categories={categories}
        classTypes={classTypes}
        defaultValues={{
          search,
          educationLevelId,
          categoryId,
          classTypeId,
        }}
      />

      <PageMeta>
        {t("showing", { count: courses.length, total })}
        {search ? (
          <span className="ml-2">{t("searchFor", { query: search })}</span>
        ) : null}
      </PageMeta>

      <PageSection className="overflow-hidden">
        <DataState
          empty={courses.length === 0}
          emptyTitle={t("noCoursesFound")}
          emptyDescription={search ? t("searchFor", { query: search }) : null}
        >
          <MobileList>
            {courses.map((course) => (
              <MobileListCard
                key={course.jwId}
                href={`/courses/${course.jwId}`}
              >
                <MobileListCardBody>
                  <MobileListCardTitle>
                    {course.namePrimary}
                  </MobileListCardTitle>
                  {course.nameSecondary ? (
                    <MobileListCardDescription>
                      {course.nameSecondary}
                    </MobileListCardDescription>
                  ) : null}
                </MobileListCardBody>
                <MobileListCardMeta>
                  <Badge variant="outline" className="font-mono">
                    {course.code}
                  </Badge>
                  {course.educationLevel ? (
                    <Badge variant="outline">
                      {course.educationLevel.namePrimary}
                    </Badge>
                  ) : null}
                  {course.category ? (
                    <Badge variant="outline">
                      {course.category.namePrimary}
                    </Badge>
                  ) : null}
                  {course.classType ? (
                    <Badge variant="outline">
                      {course.classType.namePrimary}
                    </Badge>
                  ) : null}
                </MobileListCardMeta>
              </MobileListCard>
            ))}
          </MobileList>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("courseName")}</TableHead>
                  <TableHead>{t("courseCode")}</TableHead>
                  <TableHead>{t("educationLevel")}</TableHead>
                  <TableHead>{t("category")}</TableHead>
                  <TableHead>{t("classType")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((course) => (
                  <ClickableTableRow
                    key={course.jwId}
                    href={`/courses/${course.jwId}`}
                  >
                    <TableCell>
                      {course.namePrimary}
                      {course.nameSecondary ? (
                        <div className="text-muted-foreground text-xs">
                          {course.nameSecondary}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {course.code}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {course.educationLevel ? (
                        <Badge variant="outline">
                          {course.educationLevel.namePrimary}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {course.category ? (
                        <Badge variant="outline">
                          {course.category.namePrimary}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {course.classType ? (
                        <Badge variant="outline">
                          {course.classType.namePrimary}
                        </Badge>
                      ) : null}
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
