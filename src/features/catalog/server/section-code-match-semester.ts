import { getCurrentSemester } from "@/features/catalog/server/academic-metadata-read-model";
import { prisma } from "@/lib/db/prisma";

export function resolveSectionCodeMatchSemester(semesterId?: number) {
  return semesterId
    ? prisma.semester.findUnique({
        where: { id: semesterId },
      })
    : getCurrentSemester(new Date());
}
