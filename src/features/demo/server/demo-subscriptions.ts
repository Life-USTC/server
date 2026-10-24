import type { SectionCompactDto } from "@/features/catalog/lib/academic-section-list-response-schemas";
import type { DemoIdentity } from "@/features/demo/lib/demo-types";
import type { SubscriptionKind } from "@/features/subscriptions/lib/subscription-kind";
import type { SubscriptionsTabData } from "@/features/subscriptions/server/subscription-tab-read-model";
import type { AppLocale } from "@/i18n/config";
import enUs from "../../../../messages/en-us.json";
import zhCn from "../../../../messages/zh-cn.json";

const semesters = [
  {
    id: 2602,
    jwId: 2602,
    code: "2026-spring",
    nameCn: "2026年春季学期",
    startDate: "2026-02-23T00:00:00+08:00",
    endDate: "2026-07-12T00:00:00+08:00",
  },
  {
    id: 2609,
    jwId: 2609,
    code: "2026-autumn",
    nameCn: "2026年秋季学期",
    startDate: "2026-09-01T00:00:00+08:00",
    endDate: "2027-01-24T00:00:00+08:00",
  },
];

function localizedName(locale: AppLocale, nameCn: string, nameEn: string) {
  return {
    nameCn,
    nameEn,
    namePrimary: locale === "en-us" ? nameEn : nameCn,
    nameSecondary: locale === "en-us" ? nameCn : nameEn,
  };
}

export function getDemoSubscribedSections(locale: AppLocale) {
  const teachers = [
    {
      id: 401,
      jwId: 930001,
      personId: null,
      code: "DEMO-T01",
      ...localizedName(locale, "陈老师", "Teacher Chen"),
    },
    {
      id: 402,
      jwId: 930002,
      personId: null,
      code: "DEMO-T02",
      ...localizedName(locale, "林老师", "Teacher Lin"),
    },
  ];
  const samples = [
    {
      nameCn: "线性代数",
      nameEn: "Linear Algebra",
      code: "DEMO-MATH01",
      credits: 4,
      kind: "regular",
      semester: semesters[1],
      teachers,
    },
    {
      nameCn: "大学物理",
      nameEn: "College Physics",
      code: "DEMO-PHYS01",
      credits: 3,
      kind: "auditor",
      semester: semesters[1],
      teachers: [teachers[0]],
    },
    {
      nameCn: "数据结构",
      nameEn: "Data Structures",
      code: "DEMO-CS01",
      credits: 3.5,
      kind: "teaching_assistant",
      semester: semesters[0],
      teachers: [teachers[1]],
    },
  ] as const;
  return samples.map(
    (sample, index): SectionCompactDto & { kind: SubscriptionKind } => ({
      id: 101 + index,
      jwId: 910001 + index,
      code: `${sample.code}.01`,
      credits: sample.credits,
      kind: sample.kind,
      retiredAt: null,
      bizTypeId: null,
      period: null,
      requiredWeeks: null,
      catalogAdminClasses: null,
      periodsPerWeek: null,
      timesPerWeek: null,
      stdCount: null,
      limitCount: null,
      graduateAndPostgraduate: null,
      dateTimePlaceText: null,
      dateTimePlacePersonText: null,
      actualPeriods: null,
      theoryPeriods: null,
      practicePeriods: null,
      experimentPeriods: null,
      machinePeriods: null,
      designPeriods: null,
      testPeriods: null,
      scheduleState: null,
      suggestScheduleWeeks: null,
      suggestScheduleWeekInfo: null,
      scheduleJsonParams: null,
      selectedStdCount: null,
      remark: null,
      scheduleRemark: null,
      courseId: 201 + index,
      semesterId: sample.semester.id,
      campusId: null,
      examModeId: null,
      openDepartmentId: null,
      teachLanguageId: null,
      roomTypeId: null,
      course: {
        id: 201 + index,
        jwId: 920001 + index,
        code: sample.code,
        ...localizedName(locale, sample.nameCn, sample.nameEn),
        categoryId: null,
        classTypeId: null,
        classifyId: null,
        educationLevelId: null,
        gradationId: null,
        typeId: null,
        category: null,
        classType: null,
        classify: null,
        educationLevel: null,
        gradation: null,
        type: null,
      },
      semester: { ...sample.semester },
      campus: null,
      openDepartment: null,
      teachers: sample.teachers.map((teacher) => ({ ...teacher })),
    }),
  );
}

export function getDemoSubscription(identity: DemoIdentity, locale: AppLocale) {
  return {
    userId: `demo:${identity.fixtureVersion}`,
    sections: getDemoSubscribedSections(locale),
    note: (locale === "en-us" ? enUs : zhCn).demo.readOnlyReason,
    calendarPath: null,
    calendarUrl: null,
  };
}

export function getDemoSubscriptionsTabData(
  identity: DemoIdentity,
  locale: AppLocale,
): SubscriptionsTabData {
  const { userId, sections } = getDemoSubscription(identity, locale);
  return {
    userId,
    subscriptions: [
      {
        id: userId,
        sections: sections.map(
          ({ id, jwId, code, credits, kind, course, semester, teachers }) => ({
            id,
            jwId,
            code,
            credits,
            kind,
            course: {
              code: course.code,
              jwId: course.jwId,
              namePrimary: course.namePrimary,
            },
            semester: semester
              ? {
                  id: semester.id,
                  nameCn: semester.nameCn,
                  startDate: semester.startDate,
                  endDate: semester.endDate,
                }
              : null,
            teachers: teachers.map(({ namePrimary }) => ({ namePrimary })),
            exams: [],
          }),
        ),
      },
    ],
    semesters: semesters.map(({ id, nameCn, startDate, endDate }) => ({
      id,
      nameCn,
      startDate,
      endDate,
    })),
    currentSemesterId: 2609,
    calendarSubscriptionUrl: null,
  };
}
