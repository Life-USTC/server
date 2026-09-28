import { randomInt } from "node:crypto";
import type {
  Course,
  Homework,
  Section,
} from "../../../src/generated/prisma-node/client";
import { DEV_SEED } from "./dev-seed";
import { withE2ePrisma } from "./e2e-db/prisma";
import { test as accountTest } from "./isolated-account";

export const homeworkDescription =
  "Private assignment instructions: submit a PDF with the derivation.";
type AcademicState = { course: Course; section: Section };

/** Writes own their catalog rows. The shared semester is only read. */
export const test = accountTest.extend<{
  academic: AcademicState;
  homeworks: Homework[];
}>({
  academic: async ({ account, page }, use) => {
    const marker = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
    const jwId = randomInt(1_000_000_000, 1_100_000_000);
    const academic = await withE2ePrisma((db) =>
      db.$transaction(async (tx) => {
        const semester = await tx.semester.findUniqueOrThrow({
          where: { jwId: DEV_SEED.semesterJwId },
        });
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
            semesterId: semester.id,
          },
        });
        await tx.userSectionSubscription.create({
          data: { userId: account.id, sectionId: section.id },
        });
        return { course, section };
      }),
    );
    try {
      await use(academic);
    } finally {
      try {
        await page.close();
      } finally {
        // Cascades cover all homework created by the UI, even when a failing
        // assertion prevents the test from learning the new homework ID.
        await withE2ePrisma((db) =>
          db.$transaction([
            db.section.delete({ where: { id: academic.section.id } }),
            db.course.delete({ where: { id: academic.course.id } }),
          ]),
        );
      }
    }
  },
  homeworks: async ({ account, academic }, use) => {
    const homeworks = await withE2ePrisma((db) =>
      db.$transaction(async (tx) => {
        const records = [];
        for (const isMajor of [false, true]) {
          records.push(
            await tx.homework.create({
              data: {
                sectionId: academic.section.id,
                createdById: account.id,
                title: `Isolated ${isMajor ? "major" : "standard"} homework ${academic.course.code}`,
                isMajor,
                requiresTeam: isMajor,
                publishedAt: new Date("2026-01-01T09:10:00+08:00"),
                submissionStartAt: new Date("2026-01-02T10:20:00+08:00"),
                submissionDueAt: new Date("2099-01-03T12:30:00+08:00"),
                description: {
                  create: {
                    content: homeworkDescription,
                    lastEditedById: account.id,
                  },
                },
              },
            }),
          );
        }
        return records;
      }),
    );
    await use(homeworks);
  },
});

export function storedHomeworks(sectionId: number) {
  return withE2ePrisma((db) =>
    db.homework.findMany({
      where: { sectionId },
      include: { description: true },
      orderBy: { createdAt: "asc" },
    }),
  );
}

export function storedHomeworkCompletion(userId: string, homeworkId: string) {
  return withE2ePrisma((db) =>
    db.homeworkCompletion.findUnique({
      where: { userId_homeworkId: { userId, homeworkId } },
    }),
  );
}
