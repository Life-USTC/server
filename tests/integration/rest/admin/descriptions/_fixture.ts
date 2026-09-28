import {
  type IsolatedWorker,
  test as isolatedTest,
} from "../../../../e2e/utils/isolated-worker";
import { createCatalogContractFixture } from "../../../../shared/catalog-contract-fixture";

async function prepareDescriptions(worker: IsolatedWorker) {
  const db = worker.database.owner;
  const owner = await worker.createActor();
  const admin = await worker.createActor({ isAdmin: true });
  const catalog = await createCatalogContractFixture(db);
  const homework = await db.homework.create({
    data: {
      sectionId: catalog.sections[0].id,
      title: "Known homework",
      createdById: owner.id,
    },
  });
  const [section, course, teacher, assignment, empty] = await db.$transaction(
    [
      { sectionId: catalog.sections[0].id, content: "课程建议：独立班级简介" },
      { courseId: catalog.courses[0].id, content: "Known course description" },
      {
        teacherId: catalog.teachers[0].id,
        content: "Known teacher description",
      },
      { homeworkId: homework.id, content: "Known homework description" },
      { courseId: catalog.courses[1].id, content: "" },
    ].map((data, index) =>
      db.description.create({
        data: {
          ...data,
          lastEditedById: owner.id,
          lastEditedAt: new Date(`2026-09-0${index + 1}T00:00:00Z`),
          updatedAt: new Date("2026-09-06T00:00:00Z"),
        },
      }),
    ),
  );
  return { db, owner, admin, section, course, teacher, assignment, empty };
}

export const test = isolatedTest.extend<{
  descriptionState: Awaited<ReturnType<typeof prepareDescriptions>>;
}>({
  descriptionState: async ({ isolatedWorker }, use) => {
    await use(await prepareDescriptions(isolatedWorker));
  },
});
