import { localizedNameSelect } from "@/features/section-detail/server/section-page-name-selects";
import type { Prisma } from "@/generated/prisma/client";

export const sectionPageScheduleSelect = {
  orderBy: [{ date: "asc" }, { weekday: "asc" }, { startTime: "asc" }],
  select: {
    id: true,
    date: true,
    weekday: true,
    startTime: true,
    endTime: true,
    weekIndex: true,
    startUnit: true,
    endUnit: true,
    lessonType: true,
    customPlace: true,
    room: {
      select: {
        ...localizedNameSelect,
        building: {
          select: {
            ...localizedNameSelect,
            campus: {
              select: localizedNameSelect,
            },
          },
        },
      },
    },
    teachers: {
      select: localizedNameSelect,
    },
  },
} satisfies Prisma.Section$schedulesArgs;
