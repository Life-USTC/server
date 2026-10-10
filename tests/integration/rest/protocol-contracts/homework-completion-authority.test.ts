import { expect } from "@playwright/test";
import {
  expectSuccessfulOperation as successful,
  expectAuthorizationRejected as unauthorized,
} from "./_assertions";
import { type Actor, type ProtocolFixture, test } from "./_fixture";
import {
  invokeOperation as invoke,
  type Operation,
  type OperationResult as Result,
  type Transport,
  transports,
} from "./_transport";

function notFound(transport: Transport, result: Result) {
  expect(result.response.status).toBe(transport === "mcp" ? 200 : 404);
  if (transport === "rest")
    expect(result.content.error).toEqual(expect.any(String));
  if (transport === "graphql")
    expect(result.payload.errors[0].extensions.code).toBe("NOT_FOUND");
  if (transport === "mcp") {
    expect(result.payload.error).toBeUndefined();
    expect(result.payload.result.isError).not.toBe(true);
    expect(result.content).toMatchObject({
      success: false,
      error: "not_found",
    });
  }
}

test.use({ features: ["workspace.homework"] });
function completion(id: string, completed: boolean): Operation {
  return {
    rest: {
      path: `/api/workspace/homeworks/${id}/completion`,
      method: "PUT",
      body: { completed },
    },
    graphql: {
      field: "homeworkCompletionSet",
      query:
        "mutation($id:ID!, $completed:Boolean!) { homeworkCompletionSet(homeworkId:$id,completed:$completed) { homeworkId completed completedAt } }",
      variables: { id, completed },
    },
    mcp: {
      name: "workspace_homework_completion_set",
      arguments: { homeworkId: id, completed },
    },
  };
}
async function prepare(h: ProtocolFixture) {
  const homework = await h.db.homework.create({
    data: {
      sectionId: h.section.id,
      createdById: h.actors[0].id,
      title: "Shared homework",
    },
  });
  const deleted = await h.db.homework.create({
    data: {
      sectionId: h.section.id,
      createdById: h.actors[0].id,
      title: "Deleted homework",
      deletedAt: new Date("2026-01-01T00:00:00Z"),
    },
  });
  await h.db.homeworkCompletion.createMany({
    data: h.actors.map((a) => ({
      userId: a.id,
      homeworkId: homework.id,
      completedAt: new Date("2026-01-01T01:00:00Z"),
    })),
  });
  return { homework, deleted };
}
function rows(h: ProtocolFixture) {
  return h.db.homeworkCompletion.findMany({
    where: { userId: { in: h.actors.map((actor) => actor.id) } },
    orderBy: [{ homeworkId: "asc" }, { userId: "asc" }],
  });
}
async function shared(h: ProtocolFixture) {
  return {
    homeworks: await h.db.homework.findMany({
      where: { sectionId: h.section.id },
      orderBy: { id: "asc" },
      include: {
        description: { include: { edits: { orderBy: { id: "asc" } } } },
      },
    }),
    comments: await h.db.comment.findMany({
      where: { sectionId: h.section.id },
      orderBy: { id: "asc" },
      include: {
        reactions: { orderBy: { id: "asc" } },
        attachments: { orderBy: { id: "asc" } },
      },
    }),
    descriptions: await h.db.description.findMany({
      where: { sectionId: h.section.id },
      orderBy: { id: "asc" },
      include: { edits: { orderBy: { id: "asc" } } },
    }),
    audits: await h.db.auditLog.findMany({
      where: { userId: { in: h.actors.map((a) => a.id) } },
      orderBy: { id: "asc" },
    }),
    subscriptions: await h.db.userSectionSubscription.findMany({
      where: { userId: { in: h.actors.map((a) => a.id) } },
      orderBy: [{ userId: "asc" }, { sectionId: "asc" }],
    }),
  };
}
async function update(
  h: ProtocolFixture,
  transport: Transport,
  actor: Actor,
  id: string,
  completed: boolean,
) {
  const result = successful(
    transport,
    await invoke(
      h.origin,
      transport,
      completion(id, completed),
      actor.tokens[transport],
    ),
  );
  const actual = transport === "mcp" ? result.completion : result;
  expect(actual.completed).toBe(completed);
  // REST identifies the homework in its URL; GraphQL/MCP also echo it in the result.
  if (transport !== "rest") expect(actual.homeworkId).toBe(id);
  const own = (await rows(h)).find(
    (row) => row.userId === actor.id && row.homeworkId === id,
  );
  expect(own !== undefined).toBe(completed);
  expect(
    actual.completedAt === null ? null : new Date(actual.completedAt).getTime(),
  ).toBe(own?.completedAt.getTime() ?? null);
}
for (const transport of transports) {
  test(`homework completion updates preserve both owners and shared entity through ${transport}`, {
    tag: `@Homework/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
  }, async ({ run, h }) => {
    await run(async () => {
      const { homework } = await prepare(h);
      const original = await shared(h);
      for (const actor of h.actors) {
        const foreign = (await rows(h)).filter(
          (row) => row.userId !== actor.id,
        );
        for (const completed of [false, true]) {
          await update(h, transport, actor, homework.id, completed);
          expect(
            (await rows(h)).filter((row) => row.userId !== actor.id),
          ).toEqual(foreign);
          expect(await shared(h)).toEqual(original);
        }
      }
    });
  });
  test(`homework completion authorization rejection preserves state through ${transport}`, {
    tag: `@Homework/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
  }, async ({ run, h }) => {
    await run(async () => {
      const { homework } = await prepare(h);
      const before = { entities: await shared(h), completions: await rows(h) };
      for (const reason of ["anonymous", "read_scope"] as const) {
        unauthorized(
          transport,
          await invoke(
            h.origin,
            transport,
            completion(homework.id, false),
            reason === "anonymous"
              ? undefined
              : h.actors[0].readTokens[transport],
          ),
          reason,
        );
        expect({
          entities: await shared(h),
          completions: await rows(h),
        }).toEqual(before);
      }
    });
  });
  test(`homework completion rejects deleted and missing targets without effects through ${transport}`, {
    tag: `@Homework/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
  }, async ({ run, h }) => {
    await run(async () => {
      const { deleted } = await prepare(h);
      const before = { entities: await shared(h), completions: await rows(h) };
      for (const id of [deleted.id, `${h.marker}-missing`])
        for (const completed of [true, false]) {
          notFound(
            transport,
            await invoke(
              h.origin,
              transport,
              completion(id, completed),
              h.actors[0].tokens[transport],
            ),
          );
          expect({
            entities: await shared(h),
            completions: await rows(h),
          }).toEqual(before);
        }
    });
  });
  test(`homework completion remains personal during suspension through ${transport}`, {
    tag: `@Homework/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
  }, async ({ run, h }) => {
    await run(async () => {
      const { homework } = await prepare(h);
      await h.db.userSuspension.create({
        data: { userId: h.actors[0].id, reason: h.marker },
      });
      const original = await shared(h);
      const foreign = (await rows(h)).filter(
        (row) => row.userId !== h.actors[0].id,
      );
      for (const completed of [false, true]) {
        await update(h, transport, h.actors[0], homework.id, completed);
        expect(
          (await rows(h)).filter((row) => row.userId !== h.actors[0].id),
        ).toEqual(foreign);
        expect(await shared(h)).toEqual(original);
      }
    });
  });
  test(`homework completion replay preserves its original completion timestamp through ${transport}`, {
    tag: `@Homework/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
  }, async ({ run, h }) => {
    await run(async () => {
      const { homework } = await prepare(h);
      const before = { entities: await shared(h), completions: await rows(h) };
      await update(h, transport, h.actors[0], homework.id, true);
      expect({ entities: await shared(h), completions: await rows(h) }).toEqual(
        before,
      );
    });
  });
}
