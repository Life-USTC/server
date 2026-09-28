import { expect } from "@playwright/test";
import { type ProtocolFixture, test } from "./_fixture";
import {
  nativeEnvelope,
  type Operation,
  sendOperation,
  type Transport,
  transports,
} from "./_transport";

async function invoke(
  h: ProtocolFixture,
  transport: Transport,
  operation: Operation,
  token?: string,
) {
  const response = await sendOperation(h.origin, transport, operation, token);
  const payload = await nativeEnvelope(response);
  const content =
    transport === "mcp" && payload.result?.content
      ? JSON.parse(
          payload.result.content.find(
            (part: { type: string }) => part.type === "text",
          ).text,
        )
      : transport === "graphql"
        ? payload.data?.[operation.graphql.field]
        : payload;
  return { response, payload, content };
}
type Result = Awaited<ReturnType<typeof invoke>>;
function successful(transport: Transport, result: Result) {
  expect(result.response.status, JSON.stringify(result.payload)).toBe(200);
  if (transport === "graphql") expect(result.payload.errors).toBeUndefined();
  if (transport === "mcp") {
    expect(result.payload.error).toBeUndefined();
    expect(result.payload.result.isError).not.toBe(true);
    expect(result.content.success).toBe(true);
  }
  return result.content;
}
function unauthorized(
  transport: Transport,
  result: Result,
  reason: "anonymous" | "read_scope",
) {
  expect(result.response.status).toBe(
    reason === "anonymous" || transport === "rest" ? 401 : 403,
  );
  if (transport === "graphql")
    expect(result.payload.errors[0].extensions.code).toBe(
      reason === "anonymous" ? "UNAUTHENTICATED" : "FORBIDDEN",
    );
  if (transport === "mcp") expect(result.payload.error).toBeDefined();
}
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
    test(`subscription kind ${kind} updates only its owner through ${transport}`, async ({
      h,
    }) => {
      await h.db.userSectionSubscription.createMany({
        data: h.actors.map((a) => ({
          userId: a.id,
          sectionId: h.section.id,
          kind: "regular",
        })),
      });
      const before = await rows(h);
      const result = successful(
        transport,
        await invoke(
          h,
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
      const committed = await rows(h);
      expect(
        successful(
          transport,
          await invoke(
            h,
            transport,
            changeKind(h.section.jwId, kind),
            h.actors[0].tokens[transport],
          ),
        ),
      ).toMatchObject({ sectionJwId: h.section.jwId, kind });
      expect(await rows(h)).toEqual(committed);
    });
  }
  test(`subscription kind rejects another owner membership through ${transport}`, async ({
    h,
  }) => {
    await h.db.userSectionSubscription.create({
      data: { userId: h.actors[0].id, sectionId: h.section.id },
    });
    const before = await rows(h);
    notFound(
      transport,
      await invoke(
        h,
        transport,
        changeKind(h.section.jwId, "auditor"),
        h.actors[1].tokens[transport],
      ),
    );
    expect(await rows(h)).toEqual(before);
  });
  test(`subscription kind rejects an internal section ID through ${transport}`, async ({
    h,
  }) => {
    await h.db.userSectionSubscription.create({
      data: { userId: h.actors[0].id, sectionId: h.section.id },
    });
    const before = await rows(h);
    notFound(
      transport,
      await invoke(
        h,
        transport,
        changeKind(h.section.id, "auditor"),
        h.actors[0].tokens[transport],
      ),
    );
    expect(await rows(h)).toEqual(before);
  });
  test(`subscription kind authorization rejection preserves state through ${transport}`, async ({
    h,
  }) => {
    await h.db.userSectionSubscription.createMany({
      data: h.actors.map((a) => ({ userId: a.id, sectionId: h.section.id })),
    });
    const before = await rows(h);
    for (const reason of ["anonymous", "read_scope"] as const) {
      unauthorized(
        transport,
        await invoke(
          h,
          transport,
          changeKind(h.section.jwId, "auditor"),
          reason === "anonymous"
            ? undefined
            : h.actors[0].readTokens[transport],
        ),
        reason,
      );
      expect(await rows(h)).toEqual(before);
    }
  });
  test(`subscription kind remains personal during suspension through ${transport}`, async ({
    h,
  }) => {
    await h.db.userSectionSubscription.createMany({
      data: h.actors.map((a) => ({
        userId: a.id,
        sectionId: h.section.id,
        kind: "teaching_assistant",
      })),
    });
    await h.db.userSuspension.create({
      data: { userId: h.actors[0].id, reason: h.marker },
    });
    const before = await rows(h);
    for (const kind of ["regular", "auditor"] as const) {
      expect(
        successful(
          transport,
          await invoke(
            h,
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
    }
  });
}
