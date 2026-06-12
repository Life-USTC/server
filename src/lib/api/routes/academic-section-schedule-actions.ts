import { jsonResponse, notFound } from "@/lib/api/helpers";

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

  return jsonResponse(section.schedules);
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

  return jsonResponse(section.scheduleGroups);
}
