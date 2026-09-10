import { DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";
import { parseDateInput } from "@/lib/time/parse-date-input";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { formatShanghaiDate } from "@/lib/time/shanghai-format";
import {
  type SectionOption,
  sectionOptionFromRow,
  withSubscribedSections,
} from "./subscription-read-model-shared";

export async function listSubscribedSectionOptions(
  userId: string,
  locale = DEFAULT_LOCALE,
  options: { sectionIds?: readonly number[] } = {},
): Promise<SectionOption[]> {
  return withSubscribedSections(
    userId,
    async (ids) => {
      const referenceNow = new Date();
      const todayStart = parseDateInput(formatShanghaiDate(referenceNow));
      if (!(todayStart instanceof Date)) {
        throw new Error("Failed to derive homework schedule cutoff");
      }
      const tomorrowStart = new Date(
        todayStart.getTime() + 24 * 60 * 60 * 1000,
      );
      const nowShanghai = shanghaiDayjs(referenceNow);
      const nowHHmm = nowShanghai.hour() * 100 + nowShanghai.minute();
      const sections = await getPrisma(locale).section.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          jwId: true,
          code: true,
          course: { select: { namePrimary: true } },
          semester: {
            select: { nameCn: true, startDate: true, endDate: true },
          },
          schedules: {
            where: {
              OR: [
                { date: { gte: tomorrowStart } },
                {
                  AND: [
                    { date: { gte: todayStart, lt: tomorrowStart } },
                    { startTime: { gt: nowHHmm } },
                  ],
                },
              ],
            },
            orderBy: [{ date: "asc" }, { startTime: "asc" }, { id: "asc" }],
            distinct: ["date", "startTime"],
            take: 3,
            select: { date: true, startTime: true },
          },
          teachers: { select: { namePrimary: true } },
        },
        orderBy: [{ semester: { jwId: "desc" } }, { code: "asc" }],
      });
      return sections.map((section) =>
        sectionOptionFromRow(section, referenceNow),
      );
    },
    options.sectionIds,
  );
}
