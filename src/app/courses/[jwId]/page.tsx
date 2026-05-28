import { ChevronDown } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ClickableTableRow } from "@/components/clickable-table-row";
import { PageBreadcrumbs, PageLayout } from "@/components/page-layout";
import { CommentsSkeleton, DescriptionSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { CommentAwareTabs } from "@/features/comments/components/comment-aware-tabs";
import { CommentsSection } from "@/features/comments/components/comments-section";
import { getCommentsPayload } from "@/features/comments/server/comments-server";
import { DescriptionLoader } from "@/features/descriptions/components/description-loader";
import { Link } from "@/i18n/routing";
import { parseInteger } from "@/lib/api/request-integers";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { prisma as basePrisma, getPrisma } from "@/lib/db/prisma";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ jwId: string }>;
}): Promise<Metadata> {
  const t = await getTranslations("metadata");
  const locale = await getLocale();
  const prisma = getPrisma(locale);
  const { jwId } = await params;
  const parsedId = parseInteger(jwId);

  if (parsedId === null) {
    return { title: t("pages.courses") };
  }

  const course = await prisma.course.findUnique({
    where: { jwId: parsedId },
    select: { nameCn: true, nameEn: true, code: true },
  });

  if (!course) {
    return { title: t("pages.courses") };
  }

  const courseName =
    locale === "en-us" && course.nameEn?.trim()
      ? course.nameEn.trim()
      : course.nameCn;
  const displayName = courseName || course.code;

  return {
    title: t("pages.courseDetail", {
      name: displayName,
    }),
    description: `${displayName} (${course.code})`,
    openGraph: {
      title: displayName,
    },
  };
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ jwId: string }>;
}) {
  const { jwId } = await params;
  const parsedId = parseInteger(jwId);

  if (parsedId === null) {
    notFound();
  }

  const locale = await getLocale();
  const prisma = getPrisma(locale);
  const course = await prisma.course.findUnique({
    where: { jwId: parsedId },
    include: {
      educationLevel: true,
      category: true,
      classType: true,
      sections: {
        select: {
          jwId: true,
          code: true,
          stdCount: true,
          limitCount: true,
          semester: true,
          campus: true,
          teachers: true,
        },
        orderBy: {
          semester: { jwId: "desc" },
        },
      },
    },
  });

  if (!course) {
    notFound();
  }

  const [t, tCourse, tCommon, tComments, commentCount] = await Promise.all([
    getTranslations("courseDetail"),
    getTranslations("course"),
    getTranslations("common"),
    getTranslations("comments"),
    basePrisma.comment.count({
      where: { courseId: course.id, status: { not: "deleted" } },
    }),
  ]);

  return (
    <PageLayout
      breadcrumbs={
        <PageBreadcrumbs
          items={[
            { label: tCommon("home"), href: "/" },
            { label: tCommon("courses"), href: "/courses" },
            { label: course.code },
          ]}
        />
      }
    >
      <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0 space-y-8">
          <div className="mt-2">
            <h1 className="mb-2 break-words text-display">
              {course.namePrimary}
            </h1>
            {course.nameSecondary ? (
              <p className="break-words text-muted-foreground text-subtitle">
                {course.nameSecondary}
              </p>
            ) : null}
          </div>
          <Suspense fallback={<DescriptionSkeleton />}>
            <DescriptionLoader targetType="course" targetId={course.id} />
          </Suspense>

          <CommentAwareTabs
            defaultValue="sections"
            commentValue="comments"
            tabValues={["sections", "comments"]}
            className="space-y-6"
          >
            <TabsList variant="pill">
              <TabsTab value="sections" variant="pill">
                {t("tabs.sections")}
              </TabsTab>
              <TabsTab value="comments" variant="pill">
                {t("tabs.comments")} ({commentCount})
              </TabsTab>
            </TabsList>
            <TabsPanel value="comments" keepMounted>
              <div className="space-y-4">
                <Suspense fallback={<CommentsSkeleton />}>
                  <CourseCommentsLoader
                    courseId={course.id}
                    tabCourseLabel={tComments("tabCourse")}
                  />
                </Suspense>
              </div>
            </TabsPanel>
            <TabsPanel value="sections" keepMounted>
              <div className="space-y-4">
                {course.sections.length > 0 ? (
                  <div className="space-y-3 md:hidden">
                    {course.sections.map((section) => {
                      const teachers =
                        section.teachers && section.teachers.length > 0
                          ? section.teachers
                              .map((teacher) =>
                                teacher.nameSecondary
                                  ? `${teacher.namePrimary} (${teacher.nameSecondary})`
                                  : teacher.namePrimary,
                              )
                              .join(", ")
                          : "—";

                      return (
                        <Link
                          key={section.jwId}
                          href={`/sections/${section.jwId}`}
                          className="block rounded-lg border border-border/70 bg-card/70 p-4 text-sm no-underline"
                        >
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium text-foreground">
                                {section.semester
                                  ? section.semester.nameCn
                                  : "—"}
                              </p>
                              <p className="mt-1 break-words text-muted-foreground leading-6">
                                {teachers}
                              </p>
                            </div>
                            <Badge variant="outline" className="shrink-0">
                              {section.code}
                            </Badge>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <p className="text-muted-foreground">
                                {t("campus")}
                              </p>
                              <p className="mt-1 font-medium text-foreground">
                                {section.campus
                                  ? section.campus.namePrimary
                                  : "—"}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">
                                {t("capacity")}
                              </p>
                              <p className="mt-1 font-medium text-foreground">
                                {section.stdCount ?? 0} /{" "}
                                {section.limitCount ?? "—"}
                              </p>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}

                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("semester")}</TableHead>
                        <TableHead>{t("sectionCode")}</TableHead>
                        <TableHead>{t("teachers")}</TableHead>
                        <TableHead>{t("campus")}</TableHead>
                        <TableHead>{t("capacity")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {course.sections.map((section) => (
                        <ClickableTableRow
                          key={section.jwId}
                          href={`/sections/${section.jwId}`}
                        >
                          <TableCell>
                            {section.semester ? section.semester.nameCn : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{section.code}</Badge>
                          </TableCell>
                          <TableCell>
                            <div
                              className="max-w-[12ch] truncate"
                              title={
                                section.teachers && section.teachers.length > 0
                                  ? section.teachers
                                      .map((teacher) =>
                                        teacher.nameSecondary
                                          ? `${teacher.namePrimary} (${teacher.nameSecondary})`
                                          : teacher.namePrimary,
                                      )
                                      .join(", ")
                                  : undefined
                              }
                            >
                              {section.teachers && section.teachers.length > 0
                                ? section.teachers
                                    .map((teacher) =>
                                      teacher.nameSecondary
                                        ? `${teacher.namePrimary} (${teacher.nameSecondary})`
                                        : teacher.namePrimary,
                                    )
                                    .join(", ")
                                : "—"}
                            </div>
                          </TableCell>
                          <TableCell>
                            {section.campus ? section.campus.namePrimary : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {section.stdCount ?? 0} /{" "}
                              {section.limitCount ?? "—"}
                            </Badge>
                          </TableCell>
                        </ClickableTableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {course.sections.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>{t("noSections")}</EmptyTitle>
                    </EmptyHeader>
                  </Empty>
                ) : null}
              </div>
            </TabsPanel>
          </CommentAwareTabs>
        </div>

        <aside className="min-w-0 space-y-4">
          <Collapsible className="space-y-4" defaultOpen>
            <CollapsibleTrigger className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 font-medium text-foreground text-sm lg:hidden">
              <span>{tCourse("basicInfo")}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </CollapsibleTrigger>
            <CollapsiblePanel className="lg:block">
              <Card>
                <CardHeader>
                  <CardTitle>{tCourse("basicInfo")}</CardTitle>
                </CardHeader>
                <CardPanel>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div className="flex items-baseline gap-2">
                      <span className="text-muted-foreground">
                        {tCourse("code")}
                      </span>
                      <span className="font-medium font-mono text-foreground">
                        {course.code}
                      </span>
                    </div>
                    {course.educationLevel ? (
                      <div className="flex items-baseline gap-2">
                        <span className="text-muted-foreground">
                          {tCourse("level")}
                        </span>
                        <span className="font-medium text-foreground">
                          {course.educationLevel.namePrimary}
                        </span>
                      </div>
                    ) : null}
                    {course.category ? (
                      <div className="flex items-baseline gap-2">
                        <span className="text-muted-foreground">
                          {tCourse("category")}
                        </span>
                        <span className="font-medium text-foreground">
                          {course.category.namePrimary}
                        </span>
                      </div>
                    ) : null}
                    {course.classType ? (
                      <div className="flex items-baseline gap-2">
                        <span className="text-muted-foreground">
                          {tCourse("type")}
                        </span>
                        <span className="font-medium text-foreground">
                          {course.classType.namePrimary}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </CardPanel>
              </Card>
            </CollapsiblePanel>
          </Collapsible>
        </aside>
      </div>
    </PageLayout>
  );
}

// --- Async Server Component Loaders (streamed via Suspense) ---

async function CourseCommentsLoader({
  courseId,
  tabCourseLabel,
}: {
  courseId: number;
  tabCourseLabel: string;
}) {
  const viewer = await getViewerContext({ includeAdmin: false });
  const commentsData = await getCommentsPayload(
    { type: "course", targetId: courseId },
    viewer,
  );

  const commentsInitialData = {
    commentMap: { course: commentsData.comments },
    hiddenMap: { course: commentsData.hiddenCount },
    hiddenCount: commentsData.hiddenCount,
    viewer: commentsData.viewer,
  };

  return (
    <CommentsSection
      targets={[
        {
          key: "course",
          label: tabCourseLabel,
          type: "course",
          targetId: courseId,
        },
      ]}
      initialData={commentsInitialData}
    />
  );
}
