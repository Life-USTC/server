import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ClickableTableRow } from "@/components/clickable-table-row";
import { PageBreadcrumbs, PageLayout } from "@/components/page-layout";
import { CommentsSkeleton, DescriptionSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
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
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const t = await getTranslations("metadata");
  const locale = await getLocale();
  const prisma = getPrisma(locale);
  const { id } = await params;
  const parsedId = parseInteger(id);

  if (parsedId === null) {
    return { title: t("pages.teachers") };
  }

  const teacher = await prisma.teacher.findUnique({
    where: { id: parsedId },
    select: { nameCn: true, nameEn: true },
  });

  if (!teacher) {
    return { title: t("pages.teachers") };
  }

  const teacherName =
    locale === "en-us" && teacher.nameEn?.trim()
      ? teacher.nameEn.trim()
      : teacher.nameCn;

  return {
    title: t("pages.teacherDetail", {
      name: teacherName,
    }),
    description: teacherName,
    openGraph: {
      title: teacherName,
    },
  };
}

export default async function TeacherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const prisma = getPrisma(locale);
  const isEnglish = locale === "en-us";

  const parsedId = parseInteger(id);
  if (parsedId === null) {
    notFound();
  }

  const teacher = await prisma.teacher.findUnique({
    where: { id: parsedId },
    include: {
      department: true,
      teacherTitle: true,
      sections: {
        select: {
          id: true,
          jwId: true,
          code: true,
          credits: true,
          course: true,
          semester: true,
        },
        orderBy: [
          { semester: { jwId: "desc" } },
          { course: { nameCn: "asc" } },
        ],
      },
    },
  });

  if (!teacher) {
    notFound();
  }

  const [t, tCommon, tComments, commentCount] = await Promise.all([
    getTranslations("teacherDetail"),
    getTranslations("common"),
    getTranslations("comments"),
    basePrisma.comment.count({
      where: { teacherId: teacher.id, status: { not: "deleted" } },
    }),
  ]);

  return (
    <PageLayout
      breadcrumbs={
        <PageBreadcrumbs
          items={[
            { label: tCommon("home"), href: "/" },
            { label: tCommon("teachers"), href: "/teachers" },
            { label: teacher.namePrimary },
          ]}
        />
      }
    >
      <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0 space-y-8">
          <div className="mt-2">
            <h1 className="mb-2 break-words text-display">
              {teacher.namePrimary}
              {isEnglish && teacher.nameSecondary ? (
                <span className="ml-3 text-muted-foreground">
                  ({teacher.nameSecondary})
                </span>
              ) : null}
            </h1>
            {teacher.department ? (
              <p className="break-words text-muted-foreground text-subtitle">
                {teacher.department.namePrimary}
              </p>
            ) : null}
          </div>
          <Suspense fallback={<DescriptionSkeleton />}>
            <DescriptionLoader targetType="teacher" targetId={teacher.id} />
          </Suspense>

          <CommentAwareTabs
            defaultValue="sections"
            commentValue="comments"
            tabValues={["sections", "comments"]}
            className="space-y-6"
          >
            <TabsList variant="pill">
              <TabsTab value="sections" variant="pill">
                {t("teachingSections", { count: teacher.sections.length })}
              </TabsTab>
              <TabsTab value="comments" variant="pill">
                {tComments("title")} ({commentCount})
              </TabsTab>
            </TabsList>
            <TabsPanel value="sections" keepMounted>
              {teacher.sections.length > 0 ? (
                <div className="space-y-3">
                  <div className="space-y-3 md:hidden">
                    {teacher.sections.map((section) => (
                      <Link
                        key={section.id}
                        href={`/sections/${section.jwId}`}
                        className="block rounded-lg border border-border/70 bg-card/70 p-4 text-sm no-underline"
                      >
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">
                              {section.course.namePrimary}
                            </p>
                            {section.course.nameSecondary ? (
                              <p className="mt-1 truncate text-muted-foreground">
                                {section.course.nameSecondary}
                              </p>
                            ) : null}
                          </div>
                          <Badge
                            variant="outline"
                            className="shrink-0 font-mono"
                          >
                            {section.code}
                          </Badge>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="text-muted-foreground">
                              {t("semester")}
                            </p>
                            <p className="mt-1 font-medium text-foreground">
                              {section.semester ? section.semester.nameCn : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">
                              {t("credits")}
                            </p>
                            <p className="mt-1 font-medium text-foreground">
                              {section.credits !== null ? section.credits : "—"}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>

                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("semester")}</TableHead>
                          <TableHead>{t("courseName")}</TableHead>
                          <TableHead>{t("sectionCode")}</TableHead>
                          <TableHead>{t("credits")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teacher.sections.map((section) => (
                          <ClickableTableRow
                            key={section.id}
                            href={`/sections/${section.jwId}`}
                          >
                            <TableCell>
                              {section.semester ? (
                                <Badge variant="outline">
                                  {section.semester.nameCn}
                                </Badge>
                              ) : null}
                            </TableCell>
                            <TableCell>
                              {section.course.namePrimary}
                              {section.course.nameSecondary ? (
                                <span className="ml-1 text-muted-foreground text-xs">
                                  ({section.course.nameSecondary})
                                </span>
                              ) : null}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono">
                                {section.code}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {section.credits !== null ? section.credits : "—"}
                            </TableCell>
                          </ClickableTableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>{t("noSections")}</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              )}
            </TabsPanel>
            <TabsPanel value="comments" keepMounted>
              <div className="space-y-4">
                <Suspense fallback={<CommentsSkeleton />}>
                  <TeacherCommentsLoader
                    teacherId={teacher.id}
                    tabTeacherLabel={tComments("tabTeacher")}
                  />
                </Suspense>
              </div>
            </TabsPanel>
          </CommentAwareTabs>
        </div>

        <aside className="min-w-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("basicInfo")}</CardTitle>
            </CardHeader>
            <CardPanel>
              <div className="grid grid-cols-1 gap-4 text-sm">
                <div className="flex items-baseline gap-2">
                  <span className="text-muted-foreground">{t("name")}</span>
                  <span className="font-medium text-foreground">
                    {teacher.namePrimary}
                    {teacher.nameSecondary ? (
                      <span className="ml-2 text-muted-foreground">
                        ({teacher.nameSecondary})
                      </span>
                    ) : null}
                  </span>
                </div>
                {teacher.department ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-muted-foreground">
                      {t("department")}
                    </span>
                    <span className="font-medium text-foreground">
                      {teacher.department.namePrimary}
                    </span>
                  </div>
                ) : null}
                {teacher.teacherTitle ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-muted-foreground">{t("title")}</span>
                    <span className="font-medium text-foreground">
                      {teacher.teacherTitle.namePrimary}
                    </span>
                  </div>
                ) : null}
                {teacher.email ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-muted-foreground">{t("email")}</span>
                    <span className="font-medium text-foreground">
                      {teacher.email}
                    </span>
                  </div>
                ) : null}
                {teacher.telephone ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-muted-foreground">
                      {t("telephone")}
                    </span>
                    <span className="font-medium text-foreground">
                      {teacher.telephone}
                    </span>
                  </div>
                ) : null}
                {teacher.mobile ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-muted-foreground">{t("mobile")}</span>
                    <span className="font-medium text-foreground">
                      {teacher.mobile}
                    </span>
                  </div>
                ) : null}
                {teacher.address ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-muted-foreground">
                      {t("address")}
                    </span>
                    <span className="font-medium text-foreground">
                      {teacher.address}
                    </span>
                  </div>
                ) : null}
              </div>
            </CardPanel>
          </Card>
        </aside>
      </div>
    </PageLayout>
  );
}

// --- Async Server Component Loaders (streamed via Suspense) ---

async function TeacherCommentsLoader({
  teacherId,
  tabTeacherLabel,
}: {
  teacherId: number;
  tabTeacherLabel: string;
}) {
  const viewer = await getViewerContext({ includeAdmin: false });
  const commentsData = await getCommentsPayload(
    { type: "teacher", targetId: teacherId },
    viewer,
  );

  const commentsInitialData = {
    commentMap: { teacher: commentsData.comments },
    hiddenMap: { teacher: commentsData.hiddenCount },
    hiddenCount: commentsData.hiddenCount,
    viewer: commentsData.viewer,
  };

  return (
    <CommentsSection
      targets={[
        {
          key: "teacher",
          label: tabTeacherLabel,
          type: "teacher",
          targetId: teacherId,
        },
      ]}
      initialData={commentsInitialData}
    />
  );
}
