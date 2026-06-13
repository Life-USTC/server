import type { PrismaClient, Semester } from "../../src/generated/prisma/client";
import { parseDateInput } from "../../src/lib/time/parse-date-input";

interface SemesterInterface {
  id: number;
  nameZh: string;
  code: string;
  start: string;
  end: string;
}

export type SemesterDataInterface = SemesterInterface[];

export async function loadSemesters(
  data: SemesterDataInterface,
  prisma: PrismaClient,
): Promise<Semester[]> {
  const semesters = [];

  for (const semesterJson of data) {
    const startDate = parseDateInput(semesterJson.start);
    const endDate = parseDateInput(semesterJson.end);
    if (startDate === undefined || endDate === undefined) {
      console.warn(
        `[load-semesters] Invalid semester date range for jwId=${semesterJson.id}, start=${semesterJson.start}, end=${semesterJson.end}`,
      );
      continue;
    }

    const semester = await prisma.semester.upsert({
      where: { jwId: semesterJson.id },
      update: {
        nameCn: semesterJson.nameZh,
        code: semesterJson.code,
        startDate,
        endDate,
      },
      create: {
        jwId: semesterJson.id,
        nameCn: semesterJson.nameZh,
        code: semesterJson.code,
        startDate,
        endDate,
      },
    });
    semesters.push(semester);
  }

  return semesters;
}
