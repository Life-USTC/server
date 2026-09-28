import { randomInt } from "node:crypto";
import type {
  Course,
  Section,
  Teacher,
} from "../../../src/generated/prisma-node/client";
import { DEV_SEED } from "./dev-seed";
import { withE2ePrisma } from "./e2e-db/prisma";
import { test as accountTest } from "./isolated-account";

type Catalog = {
  course: Course & { nameEn: string };
  section: Section;
  sections: Section[];
  teacher: Teacher & { nameEn: string };
  sharedTeacher: Teacher;
};

/** Two searchable sections plus semester groups; no shared catalog rows are mutated. */
export const test = accountTest.extend<{
  catalog: Catalog;
  subscriptions: Catalog;
}>({
  catalog: async ({ account: _account, page }, use) => {
    const marker = crypto
      .randomUUID()
      .replaceAll("-", "")
      .slice(0, 10)
      .toUpperCase();
    const jwId = randomInt(1_200_000_000, 1_300_000_000);
    const catalog = await withE2ePrisma((db) =>
      db.$transaction(async (tx) => {
        const current = await tx.semester.findUniqueOrThrow({
          where: { jwId: DEV_SEED.semesterJwId },
        });
        const previous = await tx.semester.findUniqueOrThrow({
          where: { jwId: DEV_SEED.previousSemesterJwId },
        });
        const teacher = await tx.teacher.create({
          data: {
            jwId,
            nameCn: `独立教师 ${marker}`,
            nameEn: `Private teacher ${marker}`,
          },
        });
        const sharedTeacher = await tx.teacher.create({
          data: {
            jwId: jwId + 1,
            nameCn: `共同教师 ${marker}`,
            nameEn: `Joint teacher ${marker}`,
          },
        });
        const courses = [];
        const sections = [];
        for (let index = 0; index < 4; index += 1) {
          const course = await tx.course.create({
            data: {
              jwId: jwId + index,
              code: `SC${marker}${index}`,
              nameCn: `独立订阅课程 ${marker} ${index}`,
              nameEn: `Private subscription course ${marker} ${index}`,
            },
          });
          courses.push(course);
          sections.push(
            await tx.section.create({
              data: {
                jwId: jwId + index,
                code: `${course.code}.01`,
                courseId: course.id,
                semesterId: index === 3 ? previous.id : current.id,
                credits: 3,
                teachers: {
                  connect:
                    index === 0
                      ? [{ id: teacher.id }, { id: sharedTeacher.id }]
                      : index === 1
                        ? [{ id: sharedTeacher.id }]
                        : [],
                },
              },
            }),
          );
        }
        if (!courses[0].nameEn || !teacher.nameEn)
          throw new Error("Expected bilingual fixture catalog");
        return {
          course: { ...courses[0], nameEn: courses[0].nameEn },
          section: sections[0],
          sections,
          teacher: { ...teacher, nameEn: teacher.nameEn },
          sharedTeacher,
          courses,
        };
      }),
    );
    try {
      await use(catalog);
    } finally {
      try {
        await page.close();
      } finally {
        await withE2ePrisma((db) =>
          db.$transaction([
            db.section.deleteMany({
              where: {
                id: { in: catalog.sections.map((section) => section.id) },
              },
            }),
            db.course.deleteMany({
              where: { id: { in: catalog.courses.map((course) => course.id) } },
            }),
            db.teacher.deleteMany({
              where: {
                id: { in: [catalog.teacher.id, catalog.sharedTeacher.id] },
              },
            }),
          ]),
        );
      }
    }
  },
  subscriptions: async ({ account, catalog }, use) => {
    await withE2ePrisma((db) =>
      db.userSectionSubscription.createMany({
        data: catalog.sections.map((section) => ({
          userId: account.id,
          sectionId: section.id,
        })),
      }),
    );
    await use(catalog);
  },
});

export function storedSectionSubscriptions(userId: string) {
  return withE2ePrisma((db) =>
    db.userSectionSubscription.findMany({
      where: { userId },
      orderBy: { sectionId: "asc" },
    }),
  );
}
