import { Prisma } from "@/generated/prisma/client";
import { authPrisma } from "@/lib/db/auth-prisma";
import { withUserDbContext } from "@/lib/db/prisma";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

export const ADMIN_USER_TRENDS_DAYS = [7, 30, 90] as const;
export type AdminUserTrendsDays = (typeof ADMIN_USER_TRENDS_DAYS)[number];

export type AdminUserTrendDailyRow = {
  activeUsers: number | null;
  day: string;
  partial: boolean;
  registeredUsers: number;
};

export type AdminUserTrendsStatus =
  | { state: "ready" }
  | { reason: "query_failed"; state: "unavailable" };

export type AdminUserTrends = {
  coverage: {
    fromDay: string;
    includesToday: true;
    timezone: "Asia/Shanghai";
    toDayExclusive: string;
  };
  daily: AdminUserTrendDailyRow[];
  days: AdminUserTrendsDays;
  firstRecordedAt: string | null;
  status: AdminUserTrendsStatus;
  summary: {
    currentUsers: number;
    periodActiveUsers: number | null;
    periodRegisteredUsers: number;
  };
};

type Window = {
  days: AdminUserTrendsDays;
  from: Date;
  fromDay: string;
  now: Date;
  todayDay: string;
  toDayExclusive: string;
};

type RegistrationRow = { count: number; day: string };
type ActiveUsersRow = { activeUsers: number; day: string };
type ActiveUsersSummaryRow = { activeUsers: number };
type FirstRecordedRow = { first: Date | null };

export function parseAdminUserTrendsDays(
  value: string | null | undefined,
): AdminUserTrendsDays {
  const parsed = Number(value);
  return parsed === 7 || parsed === 90 ? parsed : 30;
}

export function buildAdminUserTrendsWindow(
  days: AdminUserTrendsDays,
  now = new Date(),
): Window {
  const today = shanghaiDayjs(now).startOf("day");
  const from = today.subtract(days - 1, "day");
  return {
    days,
    from: from.toDate(),
    fromDay: from.format("YYYY-MM-DD"),
    now,
    todayDay: today.format("YYYY-MM-DD"),
    toDayExclusive: today.add(1, "day").format("YYYY-MM-DD"),
  };
}

function buildDailyRows(
  window: Window,
  registrations: Map<string, number>,
  activeUsers: Map<string, number>,
  firstRecordedAt: string | null,
) {
  const firstObservedDay = firstRecordedAt
    ? shanghaiDayjs(firstRecordedAt).format("YYYY-MM-DD")
    : null;
  return Array.from({ length: window.days }, (_, index) => {
    const day = shanghaiDayjs(window.from)
      .add(index, "day")
      .format("YYYY-MM-DD");
    return {
      activeUsers:
        firstObservedDay && day >= firstObservedDay
          ? (activeUsers.get(day) ?? 0)
          : null,
      day,
      partial: day === window.todayDay,
      registeredUsers: registrations.get(day) ?? 0,
    } satisfies AdminUserTrendDailyRow;
  });
}

function emptyResult(window: Window): AdminUserTrends {
  return {
    coverage: {
      fromDay: window.fromDay,
      includesToday: true,
      timezone: "Asia/Shanghai",
      toDayExclusive: window.toDayExclusive,
    },
    daily: buildDailyRows(window, new Map(), new Map(), null),
    days: window.days,
    firstRecordedAt: null,
    status: { reason: "query_failed", state: "unavailable" },
    summary: {
      currentUsers: 0,
      periodActiveUsers: null,
      periodRegisteredUsers: 0,
    },
  };
}

/**
 * Read current retained-account registrations and identified feature activity
 * for the bounded Shanghai calendar window. User rows are the current account
 * history; a deleted account cannot be reconstructed after it is removed.
 */
export async function readAdminUserTrends(
  adminId: string,
  url: URL,
  options: { now?: Date } = {},
): Promise<AdminUserTrends> {
  const days = parseAdminUserTrendsDays(url.searchParams.get("days"));
  const window = buildAdminUserTrendsWindow(days, options.now);

  try {
    const [authStats, featureStats] = await Promise.all([
      Promise.all([
        authPrisma.user.count(),
        authPrisma.$queryRaw<RegistrationRow[]>(Prisma.sql`
          SELECT
            pg_catalog.to_char(
              (account."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Shanghai',
              'YYYY-MM-DD'
            ) AS day,
            pg_catalog.count(*)::int AS count
          FROM public."User" AS account
          WHERE account."createdAt" >= ${window.from}
            AND account."createdAt" <= ${window.now}
          GROUP BY day
          ORDER BY day
        `),
      ]),
      withUserDbContext(adminId, async (tx) => {
        const [daily, summary, first] = await Promise.all([
          tx.$queryRaw<ActiveUsersRow[]>(Prisma.sql`
            SELECT
              pg_catalog.to_char(
                (event."occurredAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Shanghai',
                'YYYY-MM-DD'
              ) AS day,
              pg_catalog.count(DISTINCT event."userId")::int AS "activeUsers"
            FROM public."FeatureOperationEvent" AS event
            WHERE event."occurredAt" >= ${window.from}
              AND event."occurredAt" <= ${window.now}
              AND event."userId" IS NOT NULL
            GROUP BY day
            ORDER BY day
          `),
          tx.$queryRaw<ActiveUsersSummaryRow[]>(Prisma.sql`
            SELECT pg_catalog.count(DISTINCT event."userId")::int AS "activeUsers"
            FROM public."FeatureOperationEvent" AS event
            WHERE event."occurredAt" >= ${window.from}
              AND event."occurredAt" <= ${window.now}
              AND event."userId" IS NOT NULL
          `),
          tx.$queryRaw<FirstRecordedRow[]>(Prisma.sql`
            SELECT min(event."occurredAt") AS first
            FROM public."FeatureOperationEvent" AS event
          `),
        ]);
        return {
          daily,
          firstRecordedAt: first[0]?.first ?? null,
          periodActiveUsers: summary[0]?.activeUsers ?? 0,
        };
      }),
    ]);

    const [currentUsers, registrationRows] = authStats;
    const registrations = new Map(
      registrationRows.map((row) => [row.day, Number(row.count)]),
    );
    const activeUsers = new Map(
      featureStats.daily.map((row) => [row.day, Number(row.activeUsers)]),
    );
    const firstRecordedAt = featureStats.firstRecordedAt?.toISOString() ?? null;
    const daily = buildDailyRows(
      window,
      registrations,
      activeUsers,
      firstRecordedAt,
    );

    return {
      coverage: {
        fromDay: window.fromDay,
        includesToday: true,
        timezone: "Asia/Shanghai",
        toDayExclusive: window.toDayExclusive,
      },
      daily,
      days: window.days,
      firstRecordedAt,
      status: { state: "ready" },
      summary: {
        currentUsers,
        periodActiveUsers:
          firstRecordedAt === null ? null : featureStats.periodActiveUsers,
        periodRegisteredUsers: daily.reduce(
          (sum, row) => sum + row.registeredUsers,
          0,
        ),
      },
    };
  } catch {
    return emptyResult(window);
  }
}
