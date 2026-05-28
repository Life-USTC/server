import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { cache, Suspense } from "react";
import { EventCalendar } from "@/components/event-calendar";
import { PageBreadcrumbs, PageLayout } from "@/components/page-layout";
import { DescriptionSkeleton } from "@/components/skeletons";
import { SubscriptionCalendarButton } from "@/components/subscription-calendar-button";
import { Button } from "@/components/ui/button";
import { TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { CommentAwareTabs } from "@/features/comments/components/comment-aware-tabs";
import { DescriptionLoader } from "@/features/descriptions/components/description-loader";
import type { Prisma } from "@/generated/prisma/client";
import { Link } from "@/i18n/routing";
import { parseInteger } from "@/lib/api/request-integers";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { prisma as basePrisma, getPrisma } from "@/lib/db/prisma";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import {
  buildSectionCalendarEvents,
  computeCalendarDates,
  computeMiniCalendarData,
} from "./section-calendar-events";
import {
  BasicInfoCard,
  MiniCalendar,
  SectionHeader,
} from "./section-components";
import {
  SectionCommentsLoader,
  SectionHomeworkLoader,
} from "./section-loaders";

const SECTION_DETAIL_INCLUDE = {
  course: true,
  semester: true,
  campus: true,
  openDepartment: true,
  examMode: true,
  teachLanguage: true,
  roomType: true,
  adminClasses: true,
  teachers: {
    include: {
      department: true,
    },
  },
  schedules: {
    include: {
      room: {
        include: {
          building: {
            include: {
              campus: true,
            },
          },
        },
      },
      teachers: true,
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  },
  exams: {
    include: {
      examBatch: true,
      examRooms: true,
    },
    orderBy: { examDate: "asc" },
  },
} satisfies Prisma.SectionInclude;

const OTHER_SECTIONS_INCLUDE = {
  semester: true,
  teachers: true,
} satisfies Prisma.SectionInclude;

type LocalePrisma = ReturnType<typeof getPrisma>;

const fetchSectionDetail = cache(async (locale: string, jwId: number) => {
  const prisma = getPrisma(locale);

  return prisma.section.findUnique({
    where: { jwId },
    include: SECTION_DETAIL_INCLUDE,
  });
});

async function fetchOtherSections(
  prisma: LocalePrisma,
  section: { courseId: number; id: number },
) {
  return prisma.section.findMany({
    where: {
      courseId: section.courseId,
      id: { not: section.id },
    },
    include: OTHER_SECTIONS_INCLUDE,
    orderBy: [{ semester: { jwId: "desc" } }, { code: "asc" }],
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ jwId: string }>;
}): Promise<Metadata> {
  const t = await getTranslations("metadata");
  const locale = await getLocale();
  const { jwId } = await params;
  const parsedId = parseInteger(jwId);

  if (parsedId === null) {
    return { title: t("pages.sections") };
  }

  const section = await fetchSectionDetail(locale, parsedId);

  if (!section) {
    return { title: t("pages.sections") };
  }

  const courseName = section.course.namePrimary;
  const displayName = courseName || section.code;

  return {
    title: t("pages.sectionDetail", {
      name: displayName,
      code: section.code,
    }),
    description: `${displayName} (${section.code})`,
    openGraph: {
      title: `${displayName} — ${section.code}`,
    },
  };
}

export default async function SectionPage({
  params,
}: {
  params: Promise<{ jwId: string }>;
}) {
  const { jwId } = await params;
  const parsedJwId = parseInteger(jwId);

  if (parsedJwId === null) {
    notFound();
  }

  const locale = await getLocale();
  const prisma = getPrisma(locale);

  const section = await fetchSectionDetail(locale, parsedJwId);

  if (!section) {
    notFound();
  }

  // Parallel: semesters, otherSections, translations, viewer, and all comment/homework counts.
  // sectionTeacherCommentCount uses a nested filter to avoid a sequential second round.
  const [
    semesters,
    otherSections,
    t,
    tCommon,
    tComments,
    ,
    sectionCommentCount,
    courseCommentCount,
    sectionTeacherCommentCount,
    homeworkCount,
  ] = await Promise.all([
    prisma.semester.findMany({
      select: {
        id: true,
        startDate: true,
        endDate: true,
      },
      orderBy: {
        startDate: "asc",
      },
    }),
    fetchOtherSections(prisma, section),
    getTranslations("sectionDetail"),
    getTranslations("common"),
    getTranslations("comments"),
    getViewerContext({ includeAdmin: false }),
    basePrisma.comment.count({
      where: { sectionId: section.id, status: { not: "deleted" } },
    }),
    basePrisma.comment.count({
      where: { courseId: section.courseId, status: { not: "deleted" } },
    }),
    basePrisma.comment.count({
      where: {
        sectionTeacher: { sectionId: section.id },
        status: { not: "deleted" },
      },
    }),
    basePrisma.homework.count({
      where: { sectionId: section.id, deletedAt: null },
    }),
  ]);

  const commentCount =
    sectionCommentCount + courseCommentCount + sectionTeacherCommentCount;

  // Get current section's teacher IDs for comparison
  const currentTeacherIds = new Set(section.teachers.map((t) => t.id));
  const currentSemesterId = section.semesterId;

  // Group other sections
  const sameSemesterOtherTeachers = otherSections.filter((s) => {
    if (s.semesterId !== currentSemesterId) return false;
    const sectionTeacherIdSet = s.teachers.map((t) => t.id);
    const hasOverlap = sectionTeacherIdSet.some((id) =>
      currentTeacherIds.has(id),
    );
    return !hasOverlap;
  });

  const sameTeacherOtherSemesters = otherSections.filter((s) => {
    if (s.semesterId === currentSemesterId) return false;
    const sectionTeacherIdSet = s.teachers.map((t) => t.id);
    return sectionTeacherIdSet.some((id) => currentTeacherIds.has(id));
  });

  const teacherOptions = section.teachers.map((teacher) => ({
    id: teacher.id,
    label: teacher.namePrimary,
  }));

  const weekdayLabels = [
    t("weekdays.sunday"),
    t("weekdays.monday"),
    t("weekdays.tuesday"),
    t("weekdays.wednesday"),
    t("weekdays.thursday"),
    t("weekdays.friday"),
    t("weekdays.saturday"),
  ];

  const calendarEvents = buildSectionCalendarEvents(
    section.schedules,
    section.exams,
    section.jwId,
    section.course?.namePrimary,
    {
      classEvent: t("classEvent"),
      examEvent: t("examEvent"),
      location: t("location"),
      teacher: t("teacher"),
      units: t("units"),
      week: t("week"),
      examMode: t("examMode"),
      examBatch: t("examBatch"),
      examCount: t("examCount"),
    },
  );

  const { calendarMonthStart, scheduleDateKeys, today } = computeCalendarDates(
    calendarEvents,
    section.schedules,
  );
  const {
    miniMonthStart,
    miniDays,
    miniWeekdays,
    miniMonthLabel,
    examDateKeys,
  } = computeMiniCalendarData(calendarMonthStart, section.exams);
  const miniWeekdayLabels = [
    t("weekdays.shortSunday"),
    t("weekdays.shortMonday"),
    t("weekdays.shortTuesday"),
    t("weekdays.shortWednesday"),
    t("weekdays.shortThursday"),
    t("weekdays.shortFriday"),
    t("weekdays.shortSaturday"),
  ];
  const todayKey = today.format("YYYY-MM-DD");

  return (
    <PageLayout
      breadcrumbs={
        <PageBreadcrumbs
          items={[
            { label: tCommon("home"), href: "/" },
            { label: tCommon("sections"), href: "/sections" },
            { label: section.code },
          ]}
        />
      }
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="space-y-8">
          <SectionHeader
            courseName={section.course.namePrimary}
            courseNameSecondary={section.course.nameSecondary}
            sectionId={section.id}
            sectionJwId={section.jwId}
          />
          <Suspense fallback={<DescriptionSkeleton />}>
            <DescriptionLoader targetType="section" targetId={section.id} />
          </Suspense>

          <CommentAwareTabs
            defaultValue="homeworks"
            commentValue="comments"
            hashMappings={[{ prefix: "#homework-", value: "homeworks" }]}
            tabValues={["homeworks", "calendar", "comments"]}
            className="space-y-6"
          >
            <TabsList variant="pill">
              <TabsTab value="calendar" variant="pill">
                {t("tabs.calendar")}
              </TabsTab>
              <TabsTab value="homeworks" variant="pill">
                {t("tabs.homeworks")} ({homeworkCount as number})
              </TabsTab>
              <TabsTab value="comments" variant="pill">
                {t("tabs.comments")} ({commentCount})
              </TabsTab>
            </TabsList>
            <TabsPanel value="homeworks" keepMounted>
              <SectionHomeworkLoader
                sectionId={section.id}
                semesterStart={
                  section.semester?.startDate
                    ? toShanghaiIsoString(section.semester.startDate)
                    : null
                }
                semesterEnd={
                  section.semester?.endDate
                    ? toShanghaiIsoString(section.semester.endDate)
                    : null
                }
              />
            </TabsPanel>
            <TabsPanel value="comments" keepMounted>
              <SectionCommentsLoader
                sectionId={section.id}
                courseId={section.courseId}
                teacherOptions={teacherOptions}
                tabSectionLabel={tComments("tabSection")}
                tabCourseLabel={tComments("tabCourse")}
                tabSectionTeacherLabel={tComments("tabSectionTeacher")}
              />
            </TabsPanel>
            <TabsPanel value="calendar" keepMounted>
              <div className="space-y-3">
                <EventCalendar
                  events={calendarEvents}
                  emptyLabel={t("calendarEmpty")}
                  headerActions={
                    <>
                      <SubscriptionCalendarButton
                        sectionDatabaseId={section.id}
                        sectionJwId={section.jwId}
                        showSubscribeButton={false}
                      />
                      <Button
                        render={
                          <Link
                            className="no-underline"
                            href="/?tab=subscriptions"
                          />
                        }
                        size="sm"
                        variant="outline"
                      >
                        {t("viewAllSubscriptions")}
                      </Button>
                    </>
                  }
                  monthStart={calendarMonthStart}
                  previousMonthLabel={t("previousMonth")}
                  nextMonthLabel={t("nextMonth")}
                  semesters={semesters}
                  weekLabelHeader={t("weekLabel")}
                  weekLabelTemplate={t("weekNumber", { week: "{week}" })}
                  weekdayLabels={weekdayLabels}
                  weekStartsOn={0}
                  unscheduledLabel={t("dateTBD")}
                />
              </div>
            </TabsPanel>
          </CommentAwareTabs>
        </div>

        <aside className="space-y-4">
          <BasicInfoCard
            section={section}
            otherSections={otherSections}
            sameSemesterOtherTeachers={sameSemesterOtherTeachers}
            sameTeacherOtherSemesters={sameTeacherOtherSemesters}
            t={t}
            tCommon={tCommon}
          />
          <MiniCalendar
            monthLabel={miniMonthLabel}
            weekdayLabels={miniWeekdayLabels}
            weekdays={miniWeekdays}
            days={miniDays}
            monthStart={miniMonthStart}
            scheduleDateKeys={scheduleDateKeys}
            examDateKeys={examDateKeys}
            todayKey={todayKey}
          />
        </aside>
      </div>
    </PageLayout>
  );
}
