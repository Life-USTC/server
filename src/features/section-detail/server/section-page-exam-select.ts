import { localizedNameSelect } from "@/features/section-detail/server/section-page-name-selects";
import type { Prisma } from "@/generated/prisma/client";

export const sectionPageExamSelect = {
  orderBy: [{ examDate: "asc" }, { startTime: "asc" }],
  select: {
    id: true,
    examDate: true,
    startTime: true,
    endTime: true,
    examMode: true,
    examTakeCount: true,
    examBatch: {
      select: localizedNameSelect,
    },
    examRooms: { select: { room: true, count: true } },
  },
} satisfies Prisma.Section$examsArgs;
