import { expect, type TestAPI } from "vitest";
import {
  expectErrorCode,
  type graphqlHomeworkTest,
} from "./graphql-homework-contract-fixture";

type HomeworkContext =
  typeof graphqlHomeworkTest extends TestAPI<infer Context> ? Context : never;

export async function expectCompletionBatchPersisted(
  size: number,
  {
    homework: { fixturePrisma, marker, creatorId, ownSection, send },
    protocolRuntime,
  }: HomeworkContext,
) {
  await protocolRuntime.run(async () => {
    const homeworkIds = Array.from({ length: size }, () => crypto.randomUUID());
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
}

export async function expectCompletionBatchRejected(
  { name, count }: { name: string; count: number },
  {
    homework: { fixturePrisma, creatorId, arrangeHomework, items, send },
    protocolRuntime,
  }: HomeworkContext,
) {
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
          index === 0 ? { homeworkId: homework.id, completed: false } : item,
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
}
