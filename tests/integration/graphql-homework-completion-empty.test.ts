import { describe, expect } from "vitest";
import {
  expectErrorCode,
  graphqlHomeworkTest,
} from "../shared/graphql-homework-contract-fixture";

describe("GraphQL completion batch boundaries", () => {
  graphqlHomeworkTest.for([{ name: "empty", count: 0 }])(
    "rejects $name batches without changing existing completion",
    async (
      { name, count },
      {
        homework: { fixturePrisma, creatorId, arrangeHomework, items, send },
        protocolRuntime,
      },
    ) => {
      await protocolRuntime.run(async () => {
        const homework = await arrangeHomework();
        const completedAt = new Date("2026-09-13T08:00:00Z");
        await fixturePrisma.homeworkCompletion.create({
          data: { userId: creatorId, homeworkId: homework.id, completedAt },
        });
        const value = name.includes("duplicate")
          ? [
              { homeworkId: homework.id, completed: false },
              {
                homeworkId:
                  name === "normalized duplicate"
                    ? ` ${homework.id} `
                    : homework.id,
                completed: true,
              },
            ]
          : items(count).map((item, index) =>
              index === 0
                ? { homeworkId: homework.id, completed: false }
                : item,
            );
        expectErrorCode((await send(value)).payload, "BAD_USER_INPUT");
        expect(
          await fixturePrisma.homeworkCompletion.findMany({
            where: { userId: creatorId },
            select: { homeworkId: true, completedAt: true },
          }),
        ).toEqual([{ homeworkId: homework.id, completedAt }]);
        expect(
          await fixturePrisma.auditLog.findMany({
            where: { userId: creatorId },
          }),
        ).toEqual([]);
      });
    },
  );
});
