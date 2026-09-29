import { describe, expect } from "vitest";
import { graphqlHomeworkTest } from "../shared/graphql-homework-contract-fixture";

describe("GraphQL completion batch boundaries", () => {
  graphqlHomeworkTest.for([100])(
    "accepts %s items and persists every completion",
    async (
      size,
      {
        homework: { fixturePrisma, marker, creatorId, ownSection, send },
        protocolRuntime,
      },
    ) => {
      await protocolRuntime.run(async () => {
        const homeworkIds = Array.from({ length: size }, () =>
          crypto.randomUUID(),
        );
        await fixturePrisma.homework.createMany({
          data: homeworkIds.map((id) => ({
            id,
            sectionId: ownSection().id,
            title: `${marker} batch`,
          })),
        });
        const value = homeworkIds.map((homeworkId) => ({
          homeworkId,
          completed: true,
        }));
        const { response, payload } = await send(value);
        expect(response.status).toBe(200);
        expect(payload.errors).toBeUndefined();
        expect(payload.data?.homeworkCompletionsSet).toEqual({
          results: homeworkIds.map((homeworkId) => ({
            success: true,
            homeworkId,
          })),
        });
        expect(
          await fixturePrisma.homeworkCompletion.findMany({
            where: { homeworkId: { in: homeworkIds } },
            select: { userId: true, homeworkId: true, completedAt: true },
            orderBy: { homeworkId: "asc" },
          }),
        ).toEqual(
          [...homeworkIds].sort().map((homeworkId) => ({
            userId: creatorId,
            homeworkId,
            completedAt: expect.any(Date),
          })),
        );
      });
    },
  );
});
