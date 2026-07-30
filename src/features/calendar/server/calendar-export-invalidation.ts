import {
  invalidateUserCalendarExportCache,
  scheduleInvalidateUserCalendarExportCache,
} from "@/features/calendar/server/calendar-export-cache";
import { getCloudflareRuntimeTaskScheduler } from "@/lib/adapters/cloudflare-runtime";
import { prisma } from "@/lib/db/prisma";

export {
  invalidateUserCalendarExportCache,
  scheduleInvalidateUserCalendarExportCache,
};

export async function invalidateCalendarExportsForSection(sectionId: number) {
  const subscribers = await prisma.userSectionSubscription.findMany({
    where: { sectionId },
    select: { userId: true },
  });
  await Promise.all(
    subscribers.map((subscriber) =>
      invalidateUserCalendarExportCache(subscriber.userId),
    ),
  );
}

export function scheduleInvalidateCalendarExportsForSection(sectionId: number) {
  const scheduleTask = getCloudflareRuntimeTaskScheduler();
  const work = invalidateCalendarExportsForSection(sectionId);
  if (scheduleTask) {
    scheduleTask(work);
    return;
  }
  void work;
}
