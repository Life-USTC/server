import { expect } from "@playwright/test";
import {
  expectSuccessfulOperation as successful,
  expectAuthorizationRejected as unauthorized,
} from "./_assertions";
import { type ProtocolFixture, test } from "./_fixture";
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

test.use({ features: ["workspace.subscription"] });
function changeKind(jwId: number, kind: string): Operation {
  return {
    rest: {
      path: `/api/workspace/subscriptions/${jwId}`,
      method: "PATCH",
      body: { kind },
    },
    graphql: {
      field: "subscriptionKindUpdate",
      query:
        "mutation($id:Int!, $kind:SubscriptionKind!) { subscriptionKindUpdate(jwId:$id,kind:$kind) { kind sectionJwId } }",
      variables: { id: jwId, kind },
    },
    mcp: {
      name: "workspace_subscription_kind_update",
      arguments: { jwId, kind },
    },
  };
}
function rows(h: ProtocolFixture) {
  return h.db.userSectionSubscription.findMany({
    where: { userId: { in: h.actors.map((a) => a.id) } },
    orderBy: [{ userId: "asc" }, { sectionId: "asc" }],
  });
}
for (const transport of transports) {
  for (const kind of ["regular", "auditor", "teaching_assistant"] as const) {
    for (const operation of ["change", "repeat"] as const) {
      test(`subscription kind ${kind} ${operation} updates only its owner through ${transport}`, {
        tag: `@Subscription/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
      }, async ({ run, h }) => {
        await run(async () => {
          const initialKind =
            operation === "repeat"
              ? kind
              : kind === "regular"
                ? "auditor"
                : "regular";
          await h.db.userSectionSubscription.createMany({
            data: h.actors.map((a) => ({
              userId: a.id,
              sectionId: h.section.id,
              kind: initialKind,
              createdAt: new Date("2025-01-01T00:00:00.000Z"),
            })),
          });
          const before = await rows(h);
          const result = successful(
            transport,
            await invoke(
              h.origin,
              transport,
              changeKind(h.section.jwId, kind),
              h.actors[0].tokens[transport],
            ),
          );
          expect(result).toMatchObject({ sectionJwId: h.section.jwId, kind });
          expect(await rows(h)).toEqual(
            before.map((row) =>
              row.userId === h.actors[0].id ? { ...row, kind } : row,
            ),
          );
        });
      });
    }
  }
  test(`subscription kind rejects another owner membership through ${transport}`, {
    tag: `@Subscription/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
  }, async ({ run, h }) => {
    await run(async () => {
      await h.db.userSectionSubscription.create({
        data: { userId: h.actors[0].id, sectionId: h.section.id },
      });
      const before = await rows(h);
      notFound(
        transport,
        await invoke(
          h.origin,
          transport,
          changeKind(h.section.jwId, "auditor"),
          h.actors[1].tokens[transport],
        ),
      );
      expect(await rows(h)).toEqual(before);
    });
  });
  test(`subscription kind rejects an internal section ID through ${transport}`, {
    tag: `@Subscription/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
  }, async ({ run, h }) => {
    await run(async () => {
      await h.db.userSectionSubscription.create({
        data: { userId: h.actors[0].id, sectionId: h.section.id },
      });
      const before = await rows(h);
      notFound(
        transport,
        await invoke(
          h.origin,
          transport,
          changeKind(h.section.id, "auditor"),
          h.actors[0].tokens[transport],
        ),
      );
      expect(await rows(h)).toEqual(before);
    });
  });
  for (const reason of ["anonymous", "read_scope"] as const) {
    test(`subscription kind ${reason} rejection preserves state through ${transport}`, {
      tag: `@Subscription/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
    }, async ({ run, h }) => {
      await run(async () => {
        await h.db.userSectionSubscription.createMany({
          data: h.actors.map((a) => ({
            userId: a.id,
            sectionId: h.section.id,
          })),
        });
        const before = await rows(h);
        unauthorized(
          transport,
          await invoke(
            h.origin,
            transport,
            changeKind(h.section.jwId, "auditor"),
            reason === "anonymous"
              ? undefined
              : h.actors[0].readTokens[transport],
          ),
          reason,
        );
        expect(await rows(h)).toEqual(before);
      });
    });
  }
  for (const kind of ["regular", "auditor"] as const) {
    test(`subscription kind ${kind} remains personal during suspension through ${transport}`, {
      tag: `@Subscription/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
    }, async ({ run, h }) => {
      await run(async () => {
        await h.db.$transaction([
          h.db.userSectionSubscription.createMany({
            data: h.actors.map((a) => ({
              userId: a.id,
              sectionId: h.section.id,
              kind: "teaching_assistant",
              createdAt: new Date("2025-01-01T00:00:00.000Z"),
            })),
          }),
          h.db.userSuspension.create({
            data: { userId: h.actors[0].id, reason: h.marker },
          }),
        ]);
        const before = await rows(h);
        expect(
          successful(
            transport,
            await invoke(
              h.origin,
              transport,
              changeKind(h.section.jwId, kind),
              h.actors[0].tokens[transport],
            ),
          ),
        ).toMatchObject({ sectionJwId: h.section.jwId, kind });
        expect(await rows(h)).toEqual(
          before.map((row) =>
            row.userId === h.actors[0].id ? { ...row, kind } : row,
          ),
        );
      });
    });
  }
}
