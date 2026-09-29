import { describe, expect } from "vitest";
import { graphqlHomeworkTest } from "../shared/graphql-homework-contract-fixture";

describe("GraphQL completion batch boundaries", () => {
  graphqlHomeworkTest(
    "returns an independent not-found result for each missing target",
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
