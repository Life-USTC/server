import { describe, expect } from "vitest";
import { restWriteScope } from "@/lib/oauth/scope-registry";
import { graphqlHomeworkTest } from "../shared/graphql-homework-contract-fixture";

describe("GraphQL homework CRUD mutations", () => {
  graphqlHomeworkTest(
    "creates homework and records the normalized state and creation audit",
    async ({
      homework: {
        fixturePrisma,
        marker,
        creatorId,
        ownSection,
        execute,
        signToken,
      },
      protocolRuntime,
    }) => {
      await protocolRuntime.run(async () => {
        const creatorToken = await signToken(creatorId, [
          restWriteScope("community.section-homework"),
        ]);
        const created = await execute(
          {
            query: /* GraphQL */ `
          mutation CreateHomework(
            $sectionJwId: Int!
            $publishedAt: DateTime!
            $start: DateTime!
            $due: DateTime!
          ) {
            homeworkCreate(
              input: {
                sectionJwId: $sectionJwId
                title: "  ${marker} initial  "
                description: "  Solve question 1  "
                isMajor: true
                requiresTeam: true
                publishedAt: $publishedAt
                submissionStartAt: $start
                submissionDueAt: $due
              }
            ) {
              id
              homework {
                id
                title
                isMajor
                requiresTeam
                publishedAt
                submissionStartAt
                submissionDueAt
                completed
                commentCount
                section {
                  jwId
                }
              }
            }
          }
        `,
            variables: {
              sectionJwId: ownSection().jwId,
              publishedAt: "2026-07-20T08:00:00+08:00",
              start: "2026-07-21T08:00:00+08:00",
              due: "2026-07-22T18:00:00+08:00",
            },
          },
          creatorToken,
        );
        expect(created.response.headers.get("cache-control")).toBe("no-store");
        expect(
          created.payload.errors,
          JSON.stringify(created.payload),
        ).toBeUndefined();
        const createPayload = created.payload.data?.homeworkCreate as
          | {
              id: string;
              homework: Record<string, unknown>;
            }
          | undefined;
        expect(createPayload?.id).toEqual(expect.any(String));
        const homeworkId = createPayload?.id as string;
        expect(createPayload?.homework).toMatchObject({
          id: homeworkId,
          title: `${marker} initial`,
          isMajor: true,
          requiresTeam: true,
          publishedAt: "2026-07-20T00:00:00.000Z",
          submissionStartAt: "2026-07-21T00:00:00.000Z",
          submissionDueAt: "2026-07-22T10:00:00.000Z",
          completed: false,
          commentCount: 0,
          section: { jwId: ownSection().jwId },
        });

        const createdRecord = await fixturePrisma.homework.findUniqueOrThrow({
          where: { id: homeworkId },
          select: {
            createdById: true,
            description: { select: { content: true } },
            isMajor: true,
            requiresTeam: true,
            title: true,
          },
        });
        expect(createdRecord).toEqual({
          createdById: creatorId,
          description: { content: "Solve question 1" },
          isMajor: true,
          requiresTeam: true,
          title: `${marker} initial`,
        });
        await expect(
          fixturePrisma.auditLog.findMany({
            where: { action: "homework_create", targetId: homeworkId },
            select: { action: true, userId: true, metadata: true },
          }),
        ).resolves.toEqual([
          {
            action: "homework_create",
            userId: creatorId,
            metadata: expect.objectContaining({
              sectionId: expect.any(Number),
            }),
          },
        ]);
      });
    },
  );
});
