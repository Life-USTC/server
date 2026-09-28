import type { User } from "../../../src/generated/prisma-node/client";
import { type IsolatedWorker, test as workerTest } from "./isolated-worker";

type Database = IsolatedWorker["database"]["owner"];
type CommunityCatalog = {
  db: Database;
  course: { id: number; jwId: number };
  teacher: { id: number };
};

export const supplement = "Independent community supplement";

export const test = workerTest.extend<{
  account: User;
  community: CommunityCatalog;
}>({
  account: async ({ isolatedWorker, page }, use) => {
    const actor = await isolatedWorker.createActor();
    await page.context().addCookies([actor.cookie]);
    await use(
      await isolatedWorker.database.owner.user.findUniqueOrThrow({
        where: { id: actor.id },
      }),
    );
  },
  community: async ({ isolatedWorker }, use) => {
    const db = isolatedWorker.database.owner;
    const catalog = await db.$transaction(async (tx) => {
      const semester = await tx.semester.create({
        data: { jwId: 1, code: "2026-spring", nameCn: "2026年春季学期" },
      });
      const course = await tx.course.create({
        data: {
          jwId: 1_800_000_000,
          code: "COMMUNITY",
          nameCn: "独立社区课程",
          nameEn: "Independent community course",
        },
      });
      const teacher = await tx.teacher.create({
        data: {
          jwId: 1_800_000_000,
          nameCn: "独立社区教师",
          nameEn: "Independent community teacher",
        },
      });
      await tx.section.create({
        data: {
          jwId: 1_800_000_000,
          code: "COMMUNITY.01",
          courseId: course.id,
          semesterId: semester.id,
          teachers: { connect: { id: teacher.id } },
        },
      });
      return { course, teacher };
    });
    await use({ db, ...catalog });
  },
});

export function arrangeCourses(
  db: Database,
  options: {
    firstJwId: number;
    count: number;
    prefix: string;
    nameCn?: string;
    nameEn?: string;
  },
) {
  return db.course.createMany({
    data: Array.from({ length: options.count }, (_, index) => ({
      jwId: options.firstJwId + index,
      code: `${options.prefix}-${String(index).padStart(2, "0")}`,
      nameCn: `${options.nameCn ?? options.prefix}-${String(index).padStart(2, "0")}`,
      nameEn: options.nameEn,
    })),
  });
}

export function arrangeDescription(
  db: Database,
  targetType: "course" | "teacher",
  targetId: number,
  editorId: string,
) {
  return db.description.create({
    data: {
      [`${targetType}Id`]: targetId,
      content: supplement,
      lastEditedById: editorId,
    },
  });
}

export function storedComment(db: Database, id: string) {
  return db.comment.findUnique({ where: { id }, include: { reactions: true } });
}

export function storedDescription(db: Database, id: string) {
  return db.description.findUnique({
    where: { id },
    include: { edits: true },
  });
}

export function storedDescriptionAudits(db: Database, id: string) {
  return db.auditLog.findMany({
    where: {
      targetId: id,
      targetType: "description",
      action: "description_edit",
    },
  });
}
