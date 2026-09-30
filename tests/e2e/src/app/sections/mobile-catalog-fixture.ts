import {
  type CatalogContractFixture,
  createCatalogContractFixture,
} from "../../../../shared/catalog-contract-fixture";
import type { TestPrismaClient } from "../../../../shared/prisma";
import { test as subscriptionTest } from "../../../utils/catalog-subscription-fixture";

export const courseNames = {
  "zh-cn": "面向复杂系统的数学建模与科学计算方法",
  "en-us":
    "Mathematical Modelling and Scientific Computing for Complex Systems",
};
export const teacherNames = {
  "zh-cn": "移动端契约教师",
  "en-us": "Alexandra Catherine Montgomery",
};

/** Each case owns its full catalog graph, actor and real subscription effects. */
export const test = subscriptionTest.extend<{
  mobile: { fixture: CatalogContractFixture; user: { id: string } };
  mobileDb: <T>(work: (db: TestPrismaClient) => Promise<T>) => Promise<T>;
}>({
  mobile: async ({ isolatedWorker, run }, use) => {
    await use(
      await run(() =>
        isolatedWorker.database.owner.$transaction(async (db) => {
          const fixture = await createCatalogContractFixture({
            $transaction: async (work) => work(db),
          });
          await db.semester.update({
            where: { id: fixture.semester.id },
            data: { nameCn: "2026年秋季学期" },
          });
          await db.course.update({
            where: { id: fixture.courses[0].id },
            data: {
              code: "MATH-MOBILE-101",
              nameCn: courseNames["zh-cn"],
              nameEn: courseNames["en-us"],
            },
          });
          // Teacher URLs use the internal primary key, distinct from their JW ID.
          fixture.teachers[0] = await db.teacher.update({
            where: { id: fixture.teachers[0].id },
            data: {
              id: fixture.base + 50,
              nameCn: teacherNames["zh-cn"],
              nameEn: teacherNames["en-us"],
            },
          });
          await db.section.update({
            where: { id: fixture.sections[0].id },
            data: {
              credits: 3.5,
              period: 32,
              actualPeriods: 32,
              stdCount: 12,
              limitCount: 40,
            },
          });
          const user = await db.user.create({
            data: {
              id: crypto.randomUUID(),
              email: `${fixture.marker}@example.test`,
              name: "Mobile contract viewer",
              username: fixture.marker,
            },
          });
          return { fixture, user };
        }),
      ),
    );
  },
  mobileDb: async ({ isolatedWorker, run }, use) => {
    await use((work) => run(() => work(isolatedWorker.database.owner)));
  },
});
