import { randomInt } from "node:crypto";
import type {
  Course,
  Section,
} from "../../../src/generated/prisma-node/client";
import type { TestPrismaClient } from "../../shared/prisma";

export const homeworkDescription =
  "Private assignment instructions: submit a PDF with the derivation.";
export type AcademicState = {
  course: Course & { nameEn: string };
  section: Section;
};

export function createHomeworkAcademic(
  db: TestPrismaClient,
  userId: string,
  semesterId: number,
) {
  const marker = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const jwId = randomInt(1_000_000_000, 1_100_000_000);
  return db.$transaction(async (tx) => {
    const course = await tx.course.create({
      data: {
        jwId,
        code: `HW${marker}`,
        nameCn: `独立作业课程 ${marker}`,
        nameEn: `Isolated homework course ${marker}`,
      },
    });
    const section = await tx.section.create({
      data: {
        jwId: jwId + 1,
        code: `${course.code}.01`,
        courseId: course.id,
        semesterId,
      },
    });
    await tx.userSectionSubscription.create({
      data: { userId, sectionId: section.id },
    });
    if (!course.nameEn) throw new Error("Expected bilingual fixture course");
    return { course: { ...course, nameEn: course.nameEn }, section };
  });
}

export function createHomeworkRows(
  db: TestPrismaClient,
  userId: string,
  academic: AcademicState,
) {
  return db.$transaction(async (tx) => {
    const records = [];
    for (const isMajor of [false, true]) {
      records.push(
        await tx.homework.create({
          data: {
            sectionId: academic.section.id,
            createdById: userId,
            title: `Isolated ${isMajor ? "major" : "standard"} homework ${academic.course.code}`,
            isMajor,
            requiresTeam: isMajor,
            publishedAt: new Date("2026-01-01T09:10:00+08:00"),
            submissionStartAt: new Date("2026-01-02T10:20:00+08:00"),
            submissionDueAt: new Date("2099-01-03T12:30:00+08:00"),
            description: {
              create: {
                content: homeworkDescription,
                lastEditedById: userId,
              },
            },
          },
        }),
      );
    }
    return records;
  });
}

export function readHomeworks(db: TestPrismaClient, sectionId: number) {
  return db.homework.findMany({
    where: { sectionId },
    include: { description: true },
    orderBy: { createdAt: "asc" },
  });
}

export function readHomeworkCompletion(
  db: TestPrismaClient,
  userId: string,
  homeworkId: string,
) {
  return db.homeworkCompletion.findUnique({
    where: { userId_homeworkId: { userId, homeworkId } },
  });
}
