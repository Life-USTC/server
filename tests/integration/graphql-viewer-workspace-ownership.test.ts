import { describe, expect } from "vitest";
import { getOAuthGraphqlResourceUrl } from "@/lib/oauth/resource-urls";
import { graphqlViewerTest as it } from "../shared/graphql-viewer-fixture";

describe("GraphQL Viewer integration", () => {
  it("graphql.workspace-ownership", async ({ viewer: viewerCase }) => {
    await viewerCase.run(async () => {
      const {
        execute,
        firstUserId,
        secondUserId,
        firstSectionId,
        secondSectionId,
        createSessionCookie,
        fixturePrisma,
        graphqlBearer,
      } = viewerCase;
      for (const [userId, sectionId] of [
        [firstUserId, firstSectionId],
        [secondUserId, secondSectionId],
      ] as const) {
        const cookie = await createSessionCookie(userId);
        const { payload } = await execute(
          {
            query: `{
        workspace {
          todos { items { id } }
          subscribedSections { items { section { id } } }
          homeworks { items { section { id } } }
          schedules { items { section { id } } }
          exams { items { section { id } } }
        }
      }`,
          },
          { cookie, origin: new URL(getOAuthGraphqlResourceUrl()).origin },
        );
        expect(payload.errors).toBeUndefined();
        const workspace = payload.data?.workspace as Record<
          string,
          { items: Array<{ id?: string; section?: { id: number } }> }
        >;
        const ownedTodos = await fixturePrisma.todo.findMany({
          where: { userId },
          select: { id: true },
        });
        expect(workspace.todos.items).toEqual(ownedTodos);
        for (const field of [
          "subscribedSections",
          "homeworks",
          "schedules",
          "exams",
        ]) {
          expect(workspace[field].items.length, field).toBeGreaterThan(0);
          expect(
            workspace[field].items.every(
              (item) => item.section?.id === sectionId,
            ),
            field,
          ).toBe(true);
        }
      }
      for (const argument of [
        'userId: "other-user"',
        "sectionIds: [1]",
        "includeDeleted: true",
        "includeDescription: true",
        'visibility: "public"',
      ]) {
        const { payload } = await execute(
          { query: `{ workspace(${argument}) { todos { items { id } } } }` },
          { authorization: `Bearer ${graphqlBearer}` },
        );
        expect(payload.errors?.length, argument).toBeGreaterThan(0);
        expect(payload.data).toBeUndefined();
      }
      const { graphqlSchema } = await import("@/lib/graphql/schema");
      const workspace = graphqlSchema.getType("Workspace");
      if (!workspace || !("getFields" in workspace))
        throw new Error("Missing Workspace schema");
      const forbidden = new Set([
        "userId",
        "sectionIds",
        "visibility",
        "includeDeleted",
        "includeDescription",
        "includeCompletions",
      ]);
      for (const field of Object.values(workspace.getFields())) {
        for (const argument of field.args) {
          expect(
            forbidden.has(argument.name),
            `${field.name}.${argument.name}`,
          ).toBe(false);
          const input = graphqlSchema.getType(
            argument.type.toString().replace(/[![\]]/g, ""),
          );
          if (input && "getFields" in input) {
            for (const name of Object.keys(input.getFields()))
              expect(
                forbidden.has(name),
                `${field.name}.${argument.name}.${name}`,
              ).toBe(false);
          }
        }
      }
    });
  });
});
