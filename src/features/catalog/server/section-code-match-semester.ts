import { findCurrentSemester } from "@/lib/current-semester";
import { prisma } from "@/lib/db/prisma";

export function resolveSectionCodeMatchSemester(semesterId?: number) {
  return semesterId
    ? prisma.semester.findUnique({
        where: { id: semesterId },
      })
    : findCurrentSemester(prisma.semester, new Date());
}
