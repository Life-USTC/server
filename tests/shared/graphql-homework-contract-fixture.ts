import type { RequestEvent } from "@sveltejs/kit";
import { expect } from "vitest";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import { getOAuthGraphqlResourceUrl } from "@/lib/oauth/resource-urls";
import { restReadScope, restWriteScope } from "@/lib/oauth/scope-registry";
import { DEV_SEED } from "../fixtures/dev-seed";
import { nodeProtocolTest } from "./node-protocol-fixture";
export type GraphqlPayload = {
  data?: Record<string, unknown> | null;
  errors?: Array<{
    message: string;
    extensions?: Record<string, unknown>;
  }>;
};

function requestEvent(body: unknown, token?: string): RequestEvent {
  return {
    request: new Request("https://life.example/api/graphql", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    }),
    locals: {
      authUser: null,
      locale: "en-us",
      requestId: "graphql-homework-mutations-integration",
    },
  } as unknown as RequestEvent;
}

export function expectErrorCode(payload: GraphqlPayload, code: string) {
  expect(payload.data).toBeNull();
  expect(payload.errors?.[0]?.extensions?.code).toBe(code);
}

export const graphqlHomeworkTest = nodeProtocolTest.extend(
  "homework",
  async ({ isolatedDatabase: { owner: fixturePrisma }, protocolRuntime }) => {
    const marker = `[integration-test] graphql-homework-${crypto.randomUUID()}`;
    const oauthClientId = `graphql-homework-${crypto.randomUUID()}`;
    const creatorId = crypto.randomUUID();
    const collaboratorId = crypto.randomUUID();
    const section = await protocolRuntime.run(() =>
      fixturePrisma.$transaction(async (tx) => {
        await tx.user.createMany({
          data: [
            {
              id: creatorId,
              email: `${creatorId}@graphql-homework.test`,
              name: "GraphQL Homework Creator",
            },
            {
              id: collaboratorId,
              email: `${collaboratorId}@graphql-homework.test`,
              name: "GraphQL Homework Collaborator",
            },
          ],
        });
        const semester = await tx.semester.create({
          data: {
            jwId: DEV_SEED.semesterJwId,
            code: "graphql-homework-source",
            nameCn: "2026秋",
          },
        });
        const course = await tx.course.create({
          data: {
            jwId: DEV_SEED.course.jwId,
            code: "graphql-homework-source",
            nameCn: "GraphQL homework source",
          },
        });
        const source = { courseId: course.id, semesterId: semester.id };
        const section = await tx.section.create({
          data: {
            ...source,
            jwId: 1_800_000_000 + Math.floor(Math.random() * 100_000_000),
            code: marker,
          },
          select: { id: true, jwId: true },
        });
        await tx.oAuthClient.create({
          data: {
            clientId: oauthClientId,
            consents: {
              create: [
                {
                  scopes: [
                    restReadScope("community.section-homework"),
                    restWriteScope("community.section-homework"),
                    restWriteScope("workspace.homework"),
                  ],
                  userId: creatorId,
                },
                {
                  scopes: [
                    restReadScope("community.section-homework"),
                    restWriteScope("community.section-homework"),
                    restWriteScope("workspace.homework"),
                  ],
                  userId: collaboratorId,
                },
              ],
            },
            name: "GraphQL homework integration",
            redirectUris: ["https://graphql.example/callback"],
          },
        });
        return section;
      }),
    );
    const handler = createGraphqlRequestHandler(false);
    async function execute(body: unknown, token?: string) {
      return protocolRuntime.request(async () => {
        const response = await handler(requestEvent(body, token));
        return { response, payload: (await response.json()) as GraphqlPayload };
      });
    }

    async function signToken(userId: string, scopes: string[]) {
      return protocolRuntime.request(async () => {
        const consent = await fixturePrisma.oAuthConsent.findFirstOrThrow({
          where: {
            clientId: oauthClientId,
            scopes: { hasEvery: scopes },
            userId,
          },
          select: { grantId: true },
        });
        const issuedAt = Math.floor(Date.now() / 1000);
        const token = await signResourceBoundOAuthAccessToken({
          clientId: oauthClientId,
          grantId: consent.grantId,
          expiresAt: issuedAt + 300,
          issuedAt,
          resources: [getOAuthGraphqlResourceUrl()],
          scopes,
          userId,
        });
        if (!token) throw new Error("Expected a signed GraphQL access token");
        return token;
      });
    }

    function ownSection() {
      return section;
    }

    async function arrangeHomework() {
      return fixturePrisma.homework.create({
        data: {
          sectionId: ownSection().id,
          title: `${marker} initial`,
          createdById: creatorId,
          isMajor: true,
          requiresTeam: true,
          publishedAt: new Date("2026-07-20T00:00:00Z"),
          submissionStartAt: new Date("2026-07-21T00:00:00Z"),
          submissionDueAt: new Date("2026-07-22T10:00:00Z"),
          description: {
            create: { content: "Solve question 1", lastEditedById: creatorId },
          },
        },
      });
    }

    const items = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        homeworkId: `missing-homework-${index}`,
        completed: true,
      }));
    const send = async (value: ReturnType<typeof items>) =>
      execute(
        {
          query:
            "mutation CompletionBatch($items: [HomeworkCompletionBatchItemInput!]!) { homeworkCompletionsSet(items: $items) { results { success homeworkId } } }",
          variables: { items: value },
        },
        await signToken(creatorId, [restWriteScope("workspace.homework")]),
      );

    return {
      fixturePrisma,
      marker,
      oauthClientId,
      creatorId,
      collaboratorId,
      ownSection,
      arrangeHomework,
      execute,
      signToken,
      items,
      send,
    };
  },
);
