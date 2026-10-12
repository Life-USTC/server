import { test as workerTest } from "../../../e2e/utils/owned-worker";
import type { TestPrismaClient } from "../../../shared/prisma";

async function arrangeSearchCatalog(database: TestPrismaClient) {
  return database.$transaction(async (tx) => {
    const linearAlgebra = await tx.course.create({
      data: {
        jwId: 1101,
        code: "SEARCH-LINEAR",
        nameCn: "线性代数",
        nameEn: "Linear Algebra",
        sections: { create: { jwId: 1102, code: "SEARCH-LINEAR-SECTION" } },
      },
      include: { sections: true },
    });
    const analysisSection = await tx.section.create({
      data: {
        jwId: 1202,
        code: "SEARCH-ANALYSIS-SECTION",
        course: {
          create: {
            jwId: 1201,
            code: "SEARCH-ANALYSIS",
            nameCn: "数学分析",
            nameEn: "Mathematical Analysis",
          },
        },
        teachers: {
          create: { jwId: 1203, code: "SEARCH-TEACHER", nameCn: "程艺" },
        },
      },
    });
    return { linearAlgebra, analysisSection };
  });
}

export const test = workerTest.extend<{
  catalog: Awaited<ReturnType<typeof arrangeSearchCatalog>>;
}>({
  catalog: async ({ isolatedWorker, run }, use) => {
    await use(
      await run(() => arrangeSearchCatalog(isolatedWorker.database.owner)),
    );
  },
});
