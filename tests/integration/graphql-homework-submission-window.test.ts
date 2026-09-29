import { describe, expect } from "vitest";
import { restWriteScope } from "@/lib/oauth/scope-registry";
import {
  expectErrorCode,
  graphqlHomeworkTest,
} from "../shared/graphql-homework-contract-fixture";

describe("GraphQL homework CRUD mutations", () => {
  graphqlHomeworkTest(
    "validates the shared homework submission window before writing",
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
        const token = await signToken(creatorId, [
          restWriteScope("community.section-homework"),
        ]);
        const result = await execute(
          {
            query: /* GraphQL */ `
          mutation InvalidHomeworkWindow(
            $sectionJwId: Int!
            $start: DateTime!
            $due: DateTime!
          ) {
            homeworkCreate(
              input: {
                sectionJwId: $sectionJwId
                title: "${marker} invalid window"
                submissionStartAt: $start
                submissionDueAt: $due
              }
            ) {
              id
            }
          }
        `,
            variables: {
              sectionJwId: ownSection().jwId,
              start: "2026-08-02T08:00:00+08:00",
              due: "2026-08-01T18:00:00+08:00",
            },
          },
          token,
        );

        expectErrorCode(result.payload, "BAD_USER_INPUT");
        expect(result.payload.errors?.[0]?.message).toBe(
          "Submission start must be before due",
        );
        await expect(
          fixturePrisma.homework.count({
            where: { title: `${marker} invalid window` },
          }),
        ).resolves.toBe(0);
      });
    },
  );
});
