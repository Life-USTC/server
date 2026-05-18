import type { Prisma } from "@/generated/prisma/client";
import { DEFAULT_LOCALE } from "@/i18n/config";
import {
  buildUserCalendarFeedPath,
  ensureUserCalendarFeedToken,
} from "@/lib/calendar-feed-token";
import { selectCurrentSemesterFromList } from "@/lib/current-semester";
import { getPrisma, prisma } from "@/lib/db/prisma";
import { sectionCompactInclude } from "@/lib/query-helpers";
import { getPublicOrigin } from "@/lib/site-url";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import type {
  HomeworkWithSection,
  SectionWithRelations,
} from "./dashboard-types";

export const SECTION_SUBSCRIPTION_NOTE =
  "Life@USTC section subscriptions only affect your dashboard and calendar here. They are not official USTC course enrollment.";

const userSectionSubscriptionSelect = {
  id: true,
  calendarFeedToken: true,
  subscribedSections: {
    select: { id: true, jwId: true },
  },
} satisfies Prisma.UserSelect;

type UserSectionSubscriptionRecord = Prisma.UserGetPayload<{
  select: typeof userSectionSubscriptionSelect;
}>;

type ListSubscribedHomeworksOptions = {
  locale?: string;
  completed?: boolean;
  includeDeleted?: boolean;
  includeEditors?: boolean;
  limit?: number;
  dueAtFrom?: Date;
  dueAtTo?: Date;
  requireDueDate?: boolean;
  sectionIds?: readonly number[];
  shape?: "full" | "dashboard";
};

type SubscribedHomeworkBaseRecord = Prisma.HomeworkGetPayload<{
  include: {
    section: { include: { course: true; semester: true } };
    description: true;
    homeworkCompletions: { select: { completedAt: true } };
  };
}>;

type SubscribedHomeworkSection = NonNullable<
  SubscribedHomeworkBaseRecord["section"]
>;

type SubscribedHomeworkRecord = Omit<
  SubscribedHomeworkBaseRecord,
  "section"
> & {
  section:
    | (Omit<SubscribedHomeworkSection, "course"> & {
        course:
          | (SubscribedHomeworkSection["course"] & {
              namePrimary: string | null;
            })
          | null;
      })
    | null;
};

export interface UserSectionSubscriptionState {
  userId: string;
  subscriptionIcsUrl: string;
  subscribedSections: number[];
}

export type HomeworkSummaryItem = {
  id: string;
  title: string;
  isMajor: boolean;
  requiresTeam: boolean;
  publishedAt: string | null;
  submissionStartAt: string | null;
  submissionDueAt: string | null;
  createdAt: string;
  description: string | null;
  completion: { completedAt: string } | null;
  section: {
    jwId: number | null;
    code: string | null;
    courseName: string | null;
    semesterName: string | null;
  } | null;
};

export type SectionOption = {
  id: number;
  jwId: number | null;
  code: string | null;
  courseName: string | null;
  semesterName: string | null;
  semesterStart: string | null;
  semesterEnd: string | null;
};

async function getUserSectionSubscriptionRecord(
  userId: string,
): Promise<UserSectionSubscriptionRecord | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: userSectionSubscriptionSelect,
  });
}

function getSubscribedSectionIdsFromRecord(
  user: Pick<UserSectionSubscriptionRecord, "subscribedSections">,
) {
  return user.subscribedSections.map(({ id }) => id);
}

async function buildCalendarFeedPath(
  userId: string,
  calendarFeedToken: string | null,
) {
  const token =
    calendarFeedToken ?? (await ensureUserCalendarFeedToken(userId));
  return buildUserCalendarFeedPath(userId, token);
}

async function resolveSubscribedSectionIds(
  userId: string,
  sectionIds?: readonly number[],
) {
  return sectionIds
    ? Array.from(sectionIds)
    : await getSubscribedSectionIds(userId);
}

export async function getSubscribedSectionIds(
  userId: string,
): Promise<number[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscribedSections: {
        select: { id: true },
      },
    },
  });

  return user?.subscribedSections.map((section) => section.id) ?? [];
}

export async function getUserSectionSubscriptionState(
  userId: string,
): Promise<UserSectionSubscriptionState | null> {
  const user = await getUserSectionSubscriptionRecord(userId);
  if (!user) {
    return null;
  }

  return {
    userId: user.id,
    subscriptionIcsUrl: await buildCalendarFeedPath(
      user.id,
      user.calendarFeedToken,
    ),
    subscribedSections: getSubscribedSectionIdsFromRecord(user),
  };
}

export async function getUserCalendarSubscription(
  userId: string,
  locale = DEFAULT_LOCALE,
) {
  const localizedPrisma = getPrisma(locale);
  const user = await localizedPrisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      calendarFeedToken: true,
      subscribedSections: {
        include: sectionCompactInclude,
        orderBy: [{ semester: { jwId: "desc" } }, { code: "asc" }],
      },
    },
  });

  if (!user) {
    return null;
  }

  const calendarPath = await buildCalendarFeedPath(
    user.id,
    user.calendarFeedToken,
  );

  return {
    userId: user.id,
    sections: user.subscribedSections,
    calendarPath,
    calendarUrl: `${getPublicOrigin()}${calendarPath}`,
    note: SECTION_SUBSCRIPTION_NOTE,
  };
}

export async function getCalendarSubscriptionUrl(
  userId: string,
  calendarFeedToken?: string | null,
) {
  if (calendarFeedToken !== undefined) {
    return buildCalendarFeedPath(userId, calendarFeedToken);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, calendarFeedToken: true },
  });
  if (!user) {
    return null;
  }

  return buildCalendarFeedPath(user.id, user.calendarFeedToken);
}

async function listSubscribedSectionOptions(
  userId: string,
  locale = DEFAULT_LOCALE,
): Promise<SectionOption[]> {
  const localizedPrisma = getPrisma(locale);
  const sectionIds = await getSubscribedSectionIds(userId);
  if (sectionIds.length === 0) {
    return [];
  }

  const sections = await localizedPrisma.section.findMany({
    where: { id: { in: sectionIds } },
    select: {
      id: true,
      jwId: true,
      code: true,
      course: { select: { namePrimary: true } },
      semester: {
        select: {
          nameCn: true,
          startDate: true,
          endDate: true,
        },
      },
    },
    orderBy: [{ semester: { jwId: "desc" } }, { code: "asc" }],
  });

  return sections.map((section) => ({
    id: section.id,
    jwId: section.jwId,
    code: section.code,
    courseName: section.course?.namePrimary ?? null,
    semesterName: section.semester?.nameCn ?? null,
    semesterStart: section.semester?.startDate
      ? toShanghaiIsoString(section.semester.startDate)
      : null,
    semesterEnd: section.semester?.endDate
      ? toShanghaiIsoString(section.semester.endDate)
      : null,
  }));
}

export async function getHomeworksTabData(
  userId: string,
  locale = DEFAULT_LOCALE,
) {
  const [sections, homeworks] = await Promise.all([
    listSubscribedSectionOptions(userId, locale),
    listSubscribedHomeworks(userId, { locale }),
  ]);

  const homeworkSummaries: HomeworkSummaryItem[] = homeworks.map(
    (homework) => ({
      id: homework.id,
      title: homework.title,
      isMajor: homework.isMajor,
      requiresTeam: homework.requiresTeam,
      publishedAt: homework.publishedAt
        ? toShanghaiIsoString(homework.publishedAt)
        : null,
      submissionStartAt: homework.submissionStartAt
        ? toShanghaiIsoString(homework.submissionStartAt)
        : null,
      submissionDueAt: homework.submissionDueAt
        ? toShanghaiIsoString(homework.submissionDueAt)
        : null,
      createdAt: toShanghaiIsoString(homework.createdAt),
      description: homework.description?.content ?? null,
      completion: homework.homeworkCompletions[0]
        ? {
            completedAt: toShanghaiIsoString(
              homework.homeworkCompletions[0].completedAt,
            ),
          }
        : null,
      section: homework.section
        ? {
            jwId: homework.section.jwId ?? null,
            code: homework.section.code ?? null,
            courseName: homework.section.course?.namePrimary ?? null,
            semesterName: homework.section.semester?.nameCn ?? null,
          }
        : null,
    }),
  );

  return { homeworkSummaries, sections };
}

async function listSubscribedSectionsForSubscriptionsTab(
  userId: string,
  locale = DEFAULT_LOCALE,
) {
  const localizedPrisma = getPrisma(locale);
  const sectionIds = await getSubscribedSectionIds(userId);
  if (sectionIds.length === 0) {
    return [];
  }

  return localizedPrisma.section.findMany({
    where: { id: { in: sectionIds } },
    select: {
      id: true,
      jwId: true,
      code: true,
      credits: true,
      course: { select: { namePrimary: true } },
      semester: { select: { id: true, nameCn: true, startDate: true } },
      teachers: { select: { namePrimary: true } },
      exams: {
        select: {
          id: true,
          examDate: true,
          startTime: true,
          endTime: true,
          examMode: true,
          examRooms: { select: { room: true, count: true } },
        },
        orderBy: [{ examDate: "asc" }],
      },
    },
    orderBy: [{ semester: { jwId: "desc" } }, { code: "asc" }],
  });
}

export async function getSubscriptionsTabData(
  userId: string,
  locale = DEFAULT_LOCALE,
) {
  const localizedPrisma = getPrisma(locale);
  const [sections, semesters, calendarSubscriptionUrl] = await Promise.all([
    listSubscribedSectionsForSubscriptionsTab(userId, locale),
    localizedPrisma.semester.findMany({
      select: { id: true, nameCn: true, startDate: true, endDate: true },
      orderBy: { startDate: "asc" },
    }),
    getCalendarSubscriptionUrl(userId),
  ]);

  return {
    subscriptions:
      sections.length > 0
        ? [
            {
              id: userId,
              sections,
            },
          ]
        : [],
    semesters,
    currentSemesterId:
      selectCurrentSemesterFromList(semesters, new Date())?.id ?? null,
    userId,
    calendarSubscriptionUrl,
  };
}

export type SubscriptionsTabData = Awaited<
  ReturnType<typeof getSubscriptionsTabData>
>;

export async function listSubscribedDashboardSections(
  userId: string,
  {
    locale = DEFAULT_LOCALE,
    dateFrom,
    dateTo,
    sectionIds,
  }: {
    locale?: string;
    dateFrom?: Date;
    dateTo?: Date;
    sectionIds?: readonly number[];
  } = {},
): Promise<SectionWithRelations[]> {
  const localizedPrisma = getPrisma(locale);
  const scopedSectionIds = await resolveSubscribedSectionIds(
    userId,
    sectionIds,
  );
  if (scopedSectionIds.length === 0) {
    return [];
  }

  const [sectionRows, scheduleRows, examRows] = await Promise.all([
    localizedPrisma.section.findMany({
      where: { id: { in: scopedSectionIds } },
      select: {
        id: true,
        jwId: true,
        course: { select: { namePrimary: true } },
        semester: { select: { id: true } },
      },
      orderBy: [{ semester: { jwId: "desc" } }, { code: "asc" }],
    }),
    localizedPrisma.schedule.findMany({
      where: {
        sectionId: { in: scopedSectionIds },
        ...(dateFrom || dateTo
          ? {
              date: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {}),
              },
            }
          : {}),
      },
      select: {
        id: true,
        sectionId: true,
        date: true,
        startTime: true,
        endTime: true,
        customPlace: true,
        room: {
          select: {
            namePrimary: true,
            building: {
              select: {
                namePrimary: true,
                campus: { select: { namePrimary: true } },
              },
            },
          },
        },
        teachers: { select: { namePrimary: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    localizedPrisma.exam.findMany({
      where: { sectionId: { in: scopedSectionIds } },
      select: {
        id: true,
        sectionId: true,
        examDate: true,
        startTime: true,
        endTime: true,
        examType: true,
        examTakeCount: true,
        examMode: true,
        examRooms: {
          select: { room: true, count: true },
          orderBy: { room: "asc" },
        },
      },
      orderBy: [{ examDate: "asc" }, { startTime: "asc" }, { jwId: "asc" }],
    }),
  ]);

  const schedulesBySectionId = new Map<
    number,
    SectionWithRelations["schedules"]
  >();
  for (const row of scheduleRows) {
    const list = schedulesBySectionId.get(row.sectionId) ?? [];
    list.push({
      id: row.id,
      date: row.date,
      startTime: row.startTime,
      endTime: row.endTime,
      customPlace: row.customPlace,
      room: row.room,
      teachers: row.teachers,
    });
    schedulesBySectionId.set(row.sectionId, list);
  }

  const examsBySectionId = new Map<number, SectionWithRelations["exams"]>();
  for (const row of examRows) {
    const list = examsBySectionId.get(row.sectionId) ?? [];
    list.push({
      id: row.id,
      examDate: row.examDate,
      startTime: row.startTime,
      endTime: row.endTime,
      examType: row.examType,
      examTakeCount: row.examTakeCount,
      examMode: row.examMode,
      examRooms: row.examRooms ?? [],
    });
    examsBySectionId.set(row.sectionId, list);
  }

  return sectionRows.map((section) => ({
    id: section.id,
    jwId: section.jwId,
    course: { namePrimary: section.course.namePrimary },
    semester: section.semester,
    schedules: schedulesBySectionId.get(section.id) ?? [],
    exams: examsBySectionId.get(section.id) ?? [],
  }));
}

function buildSubscribedHomeworkInclude(
  userId: string,
  includeEditors: boolean,
) {
  return {
    section: {
      include: {
        course: true,
        semester: true,
      },
    },
    description: true,
    homeworkCompletions: {
      where: { userId },
      select: { completedAt: true },
    },
    ...(includeEditors
      ? {
          createdBy: {
            select: { id: true, name: true, username: true, image: true },
          },
          updatedBy: {
            select: { id: true, name: true, username: true, image: true },
          },
          deletedBy: {
            select: { id: true, name: true, username: true, image: true },
          },
        }
      : {}),
  } satisfies Prisma.HomeworkInclude;
}

function buildDashboardHomeworkSelect(userId: string) {
  return {
    id: true,
    title: true,
    submissionDueAt: true,
    description: { select: { content: true } },
    homeworkCompletions: {
      where: { userId },
      select: { completedAt: true },
    },
    section: {
      select: {
        jwId: true,
        course: true,
      },
    },
  } satisfies Prisma.HomeworkSelect;
}

export async function listSubscribedHomeworks(
  userId: string,
  options: ListSubscribedHomeworksOptions & { shape: "dashboard" },
): Promise<HomeworkWithSection[]>;
export async function listSubscribedHomeworks(
  userId: string,
  options?: ListSubscribedHomeworksOptions,
): Promise<SubscribedHomeworkRecord[]>;
export async function listSubscribedHomeworks(
  userId: string,
  {
    locale = DEFAULT_LOCALE,
    completed,
    includeDeleted = false,
    includeEditors = false,
    limit,
    dueAtFrom,
    dueAtTo,
    requireDueDate = false,
    sectionIds,
    shape = "full",
  }: ListSubscribedHomeworksOptions = {},
): Promise<HomeworkWithSection[] | SubscribedHomeworkRecord[]> {
  const scopedSectionIds = await resolveSubscribedSectionIds(
    userId,
    sectionIds,
  );
  if (scopedSectionIds.length === 0) {
    return [];
  }

  const localizedPrisma = getPrisma(locale);
  const query = {
    where: {
      sectionId: { in: scopedSectionIds },
      ...(includeDeleted ? {} : { deletedAt: null }),
      ...(completed === undefined
        ? {}
        : completed
          ? { homeworkCompletions: { some: { userId } } }
          : { homeworkCompletions: { none: { userId } } }),
      ...(requireDueDate ? { submissionDueAt: { not: null } } : {}),
      ...(dueAtFrom || dueAtTo
        ? {
            submissionDueAt: {
              ...(requireDueDate ? { not: null } : {}),
              ...(dueAtFrom ? { gte: dueAtFrom } : {}),
              ...(dueAtTo ? { lte: dueAtTo } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ submissionDueAt: "asc" }, { createdAt: "desc" }],
    ...(limit ? { take: limit } : {}),
  } satisfies Prisma.HomeworkFindManyArgs;

  if (shape === "dashboard") {
    return localizedPrisma.homework.findMany({
      ...query,
      select: buildDashboardHomeworkSelect(userId),
    }) as Promise<HomeworkWithSection[]>;
  }

  return localizedPrisma.homework.findMany({
    ...query,
    include: buildSubscribedHomeworkInclude(userId, includeEditors),
  });
}

export async function listSubscribedHomeworkAuditLogs(
  userId: string,
  limit = 50,
  sectionIds?: readonly number[],
) {
  const scopedSectionIds = await resolveSubscribedSectionIds(
    userId,
    sectionIds,
  );
  if (scopedSectionIds.length === 0) {
    return [];
  }

  return prisma.homeworkAuditLog.findMany({
    where: { sectionId: { in: scopedSectionIds } },
    include: {
      actor: {
        select: { id: true, name: true, username: true, image: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getHomeworkCommentCounts(homeworkIds: string[]) {
  if (homeworkIds.length === 0) {
    return new Map<string, number>();
  }

  const commentCountRows = await prisma.comment.groupBy({
    by: ["homeworkId"],
    where: {
      homeworkId: { in: homeworkIds },
      status: { not: "deleted" },
    },
    _count: { _all: true },
  });

  return new Map(
    commentCountRows.flatMap((row) =>
      row.homeworkId ? [[row.homeworkId, row._count._all] as const] : [],
    ),
  );
}

export async function listSubscribedSchedules(
  userId: string,
  {
    locale = DEFAULT_LOCALE,
    dateFrom,
    dateTo,
    weekday,
    limit,
    sectionIds,
  }: {
    locale?: string;
    dateFrom?: Date;
    dateTo?: Date;
    weekday?: number;
    limit?: number;
    sectionIds?: readonly number[];
  } = {},
) {
  const scopedSectionIds = await resolveSubscribedSectionIds(
    userId,
    sectionIds,
  );
  if (scopedSectionIds.length === 0) {
    return [];
  }

  const localizedPrisma = getPrisma(locale);
  return localizedPrisma.schedule.findMany({
    where: {
      sectionId: { in: scopedSectionIds },
      ...(dateFrom || dateTo
        ? {
            date: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
      ...(weekday ? { weekday } : {}),
    },
    include: {
      room: {
        include: {
          building: {
            include: {
              campus: true,
            },
          },
          roomType: true,
        },
      },
      teachers: {
        include: {
          department: true,
        },
      },
      section: {
        include: {
          course: true,
          semester: true,
        },
      },
      scheduleGroup: true,
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    ...(limit ? { take: limit } : {}),
  });
}

export async function listSubscribedExams(
  userId: string,
  {
    locale = DEFAULT_LOCALE,
    dateFrom,
    dateTo,
    includeDateUnknown = true,
    limit,
    sectionIds,
  }: {
    locale?: string;
    dateFrom?: Date;
    dateTo?: Date;
    includeDateUnknown?: boolean;
    limit?: number;
    sectionIds?: readonly number[];
  } = {},
) {
  const scopedSectionIds = await resolveSubscribedSectionIds(
    userId,
    sectionIds,
  );
  if (scopedSectionIds.length === 0) {
    return [];
  }

  const localizedPrisma = getPrisma(locale);
  return localizedPrisma.exam.findMany({
    where: {
      sectionId: { in: scopedSectionIds },
      ...(dateFrom || dateTo
        ? {
            OR: [
              {
                examDate: {
                  ...(dateFrom ? { gte: dateFrom } : {}),
                  ...(dateTo ? { lte: dateTo } : {}),
                },
              },
              ...(includeDateUnknown ? [{ examDate: null }] : []),
            ],
          }
        : includeDateUnknown
          ? {}
          : { examDate: { not: null } }),
    },
    include: {
      examBatch: true,
      examRooms: true,
      section: {
        include: {
          course: true,
          semester: true,
        },
      },
    },
    orderBy: [{ examDate: "asc" }, { startTime: "asc" }, { jwId: "asc" }],
    ...(limit ? { take: limit } : {}),
  });
}
