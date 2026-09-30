import type { User } from "../../../src/generated/prisma-node/client";
import { type CommunityFlow, withCommunityFlow } from "./community-flow";
import type { IsolatedWorker } from "./isolated-worker";
import { test as workerTest } from "./owned-worker";

type Database = IsolatedWorker["database"]["owner"];
type CommunityCatalog = {
  db: Database;
  course: { id: number; jwId: number };
  teacher: { id: number };
};

export const supplement = "Independent community supplement";

export const test = workerTest.extend<{
  catalogActor: Awaited<ReturnType<IsolatedWorker["createActor"]>>;
  account: User;
  community: CommunityCatalog;
  catalogFlow: CommunityFlow;
  communityFlow: Pick<CommunityFlow, "run">;
}>({
  catalogActor: async ({ isolatedWorker, run }, use) => {
    await use(await run(() => isolatedWorker.createActor()));
  },
  account: async ({ isolatedWorker, catalogActor, run }, use) => {
    await use(
      await run(() =>
        isolatedWorker.database.owner.user.findUniqueOrThrow({
          where: { id: catalogActor.id },
        }),
      ),
    );
  },
  catalogFlow: async (
    { page, browser, request: observer, isolatedWorker, run },
    use,
    testInfo,
  ) => {
    await run(() =>
      withCommunityFlow(
        { page, browser, observer, isolatedWorker, account: null, testInfo },
        use,
      ),
    );
  },
  communityFlow: async (
    {
      page,
      browser,
      request: observer,
      isolatedWorker,
      catalogActor,
      account,
      run,
    },
    use,
    testInfo,
  ) => {
    await run(() =>
      withCommunityFlow(
        { page, browser, observer, isolatedWorker, account, testInfo },
        async (flow) => {
          await use({
            run: (work, expected) =>
              flow.run(async () => {
                await page.context().addCookies([catalogActor.cookie]);
                await work();
              }, expected),
          });
        },
      ),
    );
  },
  community: async ({ isolatedWorker, run }, use) => {
    const db = isolatedWorker.database.owner;
    const catalog = await run(() =>
      db.$transaction(async (tx) => {
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
      }),
    );
    await use({ db, ...catalog });
  },
});

export function arrangeCourses(
  db: Pick<Database, "course">,
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
