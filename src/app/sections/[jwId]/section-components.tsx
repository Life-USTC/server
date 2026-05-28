import type dayjs from "dayjs";
import { ChevronDown } from "lucide-react";
import { SubscriptionCalendarButton } from "@/components/subscription-calendar-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";

// --- SectionHeader ---

export function SectionHeader({
  courseName,
  courseNameSecondary,
  sectionId,
  sectionJwId,
}: {
  courseName: string;
  courseNameSecondary: string | null;
  sectionId: number;
  sectionJwId: number;
}) {
  return (
    <div className="mt-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h1 className="mb-2 text-display">{courseName}</h1>
          {courseNameSecondary ? (
            <p className="text-muted-foreground text-sm">
              {courseNameSecondary}
            </p>
          ) : null}
        </div>
        <SubscriptionCalendarButton
          sectionDatabaseId={sectionId}
          sectionJwId={sectionJwId}
          showCalendarButton={false}
        />
      </div>
    </div>
  );
}

// --- MiniCalendar ---

export function MiniCalendar({
  monthLabel,
  weekdayLabels,
  weekdays,
  days,
  monthStart,
  scheduleDateKeys,
  examDateKeys,
  todayKey,
}: {
  monthLabel: string;
  weekdayLabels: string[];
  weekdays: number[];
  days: dayjs.Dayjs[];
  monthStart: dayjs.Dayjs;
  scheduleDateKeys: Set<string>;
  examDateKeys: Set<string>;
  todayKey: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-semibold text-sm">{monthLabel}</CardTitle>
      </CardHeader>
      <CardPanel className="space-y-2">
        <div className="grid grid-cols-7 gap-1 text-[0.65rem] text-muted-foreground">
          {weekdays.map((weekday) => (
            <div key={weekdayLabels[weekday]} className="text-center">
              {weekdayLabels[weekday]}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const dayKey = day.format("YYYY-MM-DD");
            const isCurrentMonth = day.month() === monthStart.month();
            const hasCourse = scheduleDateKeys.has(dayKey);
            const hasExam = examDateKeys.has(dayKey);
            const isToday = dayKey === todayKey;

            return (
              <div
                key={dayKey}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md p-1 text-xs",
                  !isCurrentMonth && "text-muted-foreground/50",
                )}
              >
                <span
                  className={cn(
                    isToday &&
                      "underline decoration-foreground underline-offset-2",
                  )}
                >
                  {day.date()}
                </span>
                {isCurrentMonth && (hasCourse || hasExam) ? (
                  <div className="flex items-center gap-1">
                    {hasCourse ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
                    ) : null}
                    {hasExam ? (
                      <span className="h-1.5 w-1.5 rounded-full border border-foreground" />
                    ) : null}
                  </div>
                ) : (
                  <span className="h-1.5" />
                )}
              </div>
            );
          })}
        </div>
      </CardPanel>
    </Card>
  );
}

// --- BasicInfoCard ---

type BasicInfoSection = {
  id: number;
  jwId: number;
  code: string;
  courseId: number;
  semesterId: number | null;
  credits: number | null;
  period: number | null;
  actualPeriods: number | null;
  remark: string | null;
  graduateAndPostgraduate: boolean | null;
  timesPerWeek: number | null;
  periodsPerWeek: number | null;
  theoryPeriods: number | null;
  practicePeriods: number | null;
  experimentPeriods: number | null;
  machinePeriods: number | null;
  designPeriods: number | null;
  testPeriods: number | null;
  semester: { nameCn: string } | null;
  campus: { namePrimary: string; nameSecondary: string | null } | null;
  examMode: { namePrimary: string } | null;
  teachLanguage: { namePrimary: string } | null;
  roomType: { namePrimary: string } | null;
  teachers: {
    id: number;
    namePrimary: string;
    department: { namePrimary: string } | null;
  }[];
  adminClasses: { id: number; namePrimary: string }[];
  course: { jwId: number };
};

type OtherSectionItem = {
  id: number;
  jwId: number;
  code: string;
  semesterId: number | null;
  semester: { nameCn: string } | null;
  teachers: { id: number; namePrimary: string }[];
};

export function BasicInfoCard({
  section,
  otherSections,
  sameSemesterOtherTeachers,
  sameTeacherOtherSemesters,
  t,
  tCommon,
}: {
  section: BasicInfoSection;
  otherSections: OtherSectionItem[];
  sameSemesterOtherTeachers: OtherSectionItem[];
  sameTeacherOtherSemesters: OtherSectionItem[];
  t: (key: string, params?: Record<string, string | number | Date>) => string;
  tCommon: (key: string) => string;
}) {
  if (!section) return null;

  return (
    <Collapsible className="space-y-4" defaultOpen>
      <CollapsibleTrigger className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 font-medium text-foreground text-sm lg:hidden">
        <span>{t("basicInfo")}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </CollapsibleTrigger>
      <CollapsiblePanel className="lg:block">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("basicInfo")}</CardTitle>
          </CardHeader>
          <CardPanel>
            <div className="grid grid-cols-1 gap-2 text-sm">
              {section.semester ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-muted-foreground">{t("semester")}</span>
                  <span className="font-medium text-foreground">
                    {section.semester.nameCn}
                  </span>
                </div>
              ) : null}

              {section.code ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-muted-foreground">
                    {t("sectionCode")}
                  </span>
                  <span className="font-medium font-mono text-foreground">
                    {section.code}
                  </span>
                </div>
              ) : null}

              <div className="mt-4" />

              {section.campus ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-muted-foreground">{t("campus")}</span>
                  <span className="font-medium text-foreground">
                    {section.campus.namePrimary}
                    {section.campus.nameSecondary ? (
                      <span className="ml-1 font-normal text-muted-foreground text-sm">
                        ({section.campus.nameSecondary})
                      </span>
                    ) : null}
                  </span>
                </div>
              ) : null}

              <div className="flex items-baseline gap-2">
                <span className="text-muted-foreground">
                  {tCommon("undergraduateGraduate")}
                </span>
                <span className="font-medium text-foreground">
                  {section.graduateAndPostgraduate ? "✓" : "×"}
                </span>
              </div>

              {section.credits !== null ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-muted-foreground">{t("credits")}</span>
                  <span className="font-medium text-foreground">
                    {section.credits}
                  </span>
                </div>
              ) : null}

              {section.period !== null ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-muted-foreground">{t("period")}</span>
                  <span className="font-medium text-foreground">
                    {section.period}
                    {section.actualPeriods !== null &&
                    section.actualPeriods !== section.period
                      ? ` (${section.actualPeriods})`
                      : null}
                  </span>
                </div>
              ) : null}

              {section.examMode ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-muted-foreground">{t("examMode")}</span>
                  <span className="font-medium text-foreground">
                    {section.examMode.namePrimary}
                  </span>
                </div>
              ) : null}

              {section.remark ? (
                <div className="mt-6">
                  <p className="mb-1 text-muted-foreground text-sm">
                    {t("remark")}
                  </p>
                  <p className="whitespace-pre-wrap text-body text-foreground">
                    {section.remark}
                  </p>
                </div>
              ) : null}

              {section.teachers && section.teachers.length > 0 ? (
                <div className="mt-6">
                  <p className="mb-2 text-muted-foreground text-sm">
                    {t("teachers")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {section.teachers.map((teacher) => (
                      <Link
                        key={teacher.id}
                        href={`/teachers/${teacher.id}`}
                        className="no-underline"
                      >
                        <Badge
                          variant="secondary"
                          className="cursor-pointer hover:bg-secondary/80"
                        >
                          {teacher.namePrimary}
                          {teacher.department ? (
                            <span className="ml-1 text-muted-foreground">
                              ({teacher.department.namePrimary})
                            </span>
                          ) : null}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <Collapsible className="mt-6">
              <CollapsibleTrigger className="flex items-center text-muted-foreground text-sm hover:underline">
                {t("moreDetails")} ↓
              </CollapsibleTrigger>
              <CollapsiblePanel className="mt-6">
                <MoreDetails section={section} t={t} />

                {section.adminClasses && section.adminClasses.length > 0 ? (
                  <div className="mt-6">
                    <p className="mb-2 text-muted-foreground text-sm">
                      {t("adminClasses")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {section.adminClasses.map((ac) => (
                        <Badge key={ac.id} variant="secondary">
                          {ac.namePrimary}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                <RelatedSections
                  sameSemesterOtherTeachers={sameSemesterOtherTeachers}
                  sameTeacherOtherSemesters={sameTeacherOtherSemesters}
                  t={t}
                />
              </CollapsiblePanel>
            </Collapsible>

            <div className="mt-6">
              <Link
                href={`/courses/${section.course.jwId}`}
                className="inline-flex max-w-full text-muted-foreground text-sm hover:underline"
              >
                {t("viewAllCourseSections")} ({otherSections.length + 1})
              </Link>
            </div>
          </CardPanel>
        </Card>
      </CollapsiblePanel>
    </Collapsible>
  );
}

// Inner sub-components for BasicInfoCard to keep each function focused

const DETAIL_PERIOD_FIELDS = [
  "teachLanguage",
  "roomType",
  "timesPerWeek",
  "periodsPerWeek",
  "theoryPeriods",
  "practicePeriods",
  "experimentPeriods",
  "machinePeriods",
  "designPeriods",
  "testPeriods",
] as const;

function MoreDetails({
  section,
  t,
}: {
  section: BasicInfoSection;
  t: (key: string) => string;
}) {
  const rows: { label: string; value: string | number }[] = [];

  for (const field of DETAIL_PERIOD_FIELDS) {
    const raw = section[field];
    if (!raw) continue;
    const value =
      typeof raw === "object" && "namePrimary" in raw ? raw.namePrimary : raw;
    rows.push({ label: t(field), value });
  }

  if (rows.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-2 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline gap-2">
          <span className="text-muted-foreground">{row.label}</span>
          <span className="font-medium text-foreground">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function RelatedSections({
  sameSemesterOtherTeachers,
  sameTeacherOtherSemesters,
  t,
}: {
  sameSemesterOtherTeachers: OtherSectionItem[];
  sameTeacherOtherSemesters: OtherSectionItem[];
  t: (key: string) => string;
}) {
  if (
    sameSemesterOtherTeachers.length === 0 &&
    sameTeacherOtherSemesters.length === 0
  ) {
    return null;
  }

  return (
    <div className="mt-6 space-y-4">
      {sameSemesterOtherTeachers.length > 0 ? (
        <div>
          <p className="mb-2 text-muted-foreground text-sm">
            {t("sameSemesterOtherTeachers")}
          </p>
          <div className="flex flex-wrap gap-x-2">
            {sameSemesterOtherTeachers.slice(0, 10).map((otherSection) => (
              <Link
                key={otherSection.id}
                href={`/sections/${otherSection.jwId}`}
                className="no-underline"
              >
                <Badge
                  variant="outline"
                  className="cursor-pointer hover:bg-accent"
                >
                  {otherSection.teachers.length > 0 ? (
                    <span>
                      {otherSection.teachers
                        .map((teacher) => teacher.namePrimary)
                        .join(", ")}
                    </span>
                  ) : (
                    <span>{t("noTeacher")}</span>
                  )}
                  <span className="ml-1 text-muted-foreground">
                    {otherSection.code}
                  </span>
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {sameTeacherOtherSemesters.length > 0 ? (
        <div>
          <p className="mb-2 text-muted-foreground text-sm">
            {t("sameTeacherOtherSemesters")}
          </p>
          <div className="flex flex-wrap gap-x-2">
            {sameTeacherOtherSemesters.slice(0, 10).map((otherSection) => (
              <Link
                key={otherSection.id}
                href={`/sections/${otherSection.jwId}`}
                className="no-underline"
              >
                <Badge
                  variant="outline"
                  className="cursor-pointer hover:bg-accent"
                >
                  {otherSection.semester ? (
                    <span>{otherSection.semester.nameCn}</span>
                  ) : null}
                  <span className="ml-1 text-muted-foreground">
                    {otherSection.code}
                  </span>
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
