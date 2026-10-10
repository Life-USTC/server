import { describe, expect } from "vitest";
import {
  expectCompletionBatchPersisted,
  expectCompletionBatchRejected,
} from "../shared/graphql-homework-completion-scenarios";
import { graphqlHomeworkTest } from "../shared/graphql-homework-contract-fixture";

describe("GraphQL completion batch boundaries", () => {
  graphqlHomeworkTest.for([1, 100])(
    "accepts %s items and persists every completion",
    { tags: ["@Homework/GraphQL"] },
    expectCompletionBatchPersisted,
  );

  graphqlHomeworkTest.for([
    { name: "empty", count: 0 },
    { name: "over 100", count: 101 },
    { name: "duplicate", count: 2 },
    { name: "normalized duplicate", count: 2 },
  ])(
    "rejects $name batches without changing existing completion",
    { tags: ["@Homework/GraphQL"] },
    expectCompletionBatchRejected,
  );

  graphqlHomeworkTest(
    "returns an independent not-found result for each missing target",
    { tags: ["@Homework/GraphQL"] },
    async ({
      homework: { fixturePrisma, creatorId, items, send },
      protocolRuntime,
    }) => {
      await protocolRuntime.run(async () => {
        const { payload } = await send(items(2));
        expect(payload.errors).toBeUndefined();
        expect(payload.data?.homeworkCompletionsSet).toEqual({
          results: items(2).map(({ homeworkId }) => ({
            success: false,
            homeworkId,
          })),
        });
        expect(
          await fixturePrisma.homeworkCompletion.findMany({
            where: { userId: creatorId },
          }),
        ).toEqual([]);
      });
    },
  );
});
