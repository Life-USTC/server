import { jsonResponse, notFound } from "@/lib/api/helpers";
import {
  serializeScheduleGroupTimeFields,
  serializeScheduleTimeFields,
} from "@/lib/schedule-serialization";

export async function getSectionSchedulesAction(parsedJwId: number) {
  const { getPrisma } = await import("@/lib/db/prisma");
  const section = await getPrisma("zh-cn").section.findUnique({
    where: { jwId: parsedJwId },
    include: {
      schedules: {
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
          scheduleGroup: true,
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      },
    },
  });

  if (!section) {
    return notFound("Section not found");
  }

  return jsonResponse(section.schedules.map(serializeScheduleTimeFields));
}

export async function getSectionScheduleGroupsAction(parsedJwId: number) {
  const { getPrisma } = await import("@/lib/db/prisma");
  const section = await getPrisma("zh-cn").section.findUnique({
    where: { jwId: parsedJwId },
    include: {
      scheduleGroups: {
        select: { schedules: true },
        orderBy: [{ isDefault: "desc" }, { no: "asc" }],
      },
    },
  });

  if (!section) {
    return notFound("Section not found");
  }

  return jsonResponse(
    section.scheduleGroups.map(serializeScheduleGroupTimeFields),
  );
}
