import { DEFAULT_LOCALE } from "@/i18n/config";
import { prisma as basePrisma, getPrisma } from "@/lib/db/prisma";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { resolveOverviewSemesterContext } from "./dashboard-overview-semesters";
import type { OverviewDataOptions } from "./dashboard-overview-types";

export function getDashboardSemesters() {
  return basePrisma.semester.findMany({
    select: {
      id: true,
      nameCn: true,
      startDate: true,
      endDate: true,
    },
    orderBy: { startDate: "asc" },
  });
}

export async function resolveDashboardOverviewContext(
  userId: string,
  options: OverviewDataOptions,
) {
  const locale = options.locale ?? DEFAULT_LOCALE;
  const localizedPrisma = getPrisma(locale);
  const referenceNow = options.referenceNow
    ? shanghaiDayjs(options.referenceNow)
    : shanghaiDayjs();
  const referenceDate = referenceNow.toDate();

  const [semesters, user] = await Promise.all([
    options.semesters
      ? Promise.resolve(Array.from(options.semesters))
      : getDashboardSemesters(),
    options.user
      ? Promise.resolve(options.user)
      : basePrisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            name: true,
            username: true,
          },
        }),
  ]);

  return {
    locale,
    localizedPrisma,
    referenceDate,
    referenceNow,
    semesters,
    user,
    semesterContext: resolveOverviewSemesterContext({
      calendarSemesterId: options.calendarSemesterId,
      referenceDate,
      referenceNow,
      semesters,
    }),
  };
}
