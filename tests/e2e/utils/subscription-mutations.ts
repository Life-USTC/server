import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { type APIRequestContext, expect, type Page } from "@playwright/test";
import { type OAuthOwner, parseTextContent } from "../src/app/api/mcp/helpers";
import type {
  CalendarProtocol,
  CalendarProtocolChecks,
} from "./calendar-protocol-lifecycle";
import type { PrivateCalendar } from "./private-calendar-fixture";
import {
  authorizeSubscription,
  expectSubscriptionProtocol,
  expectSubscriptionState,
  signInSubscriptionOwner,
} from "./subscription-consumption";

export const subscriptionTransports = [
  "REST session",
  "REST bearer",
  "GraphQL session",
  "GraphQL bearer",
  "MCP bearer",
] as const;
export type SubscriptionTransport = (typeof subscriptionTransports)[number];
export type SubscriptionRelation = {
  userId: string;
  sectionId: number;
  kind: "regular" | "auditor" | "teaching_assistant";
};

export async function createSubscriptionMutationFixture(
  owner: OAuthOwner,
  createCalendar: () => Promise<PrivateCalendar>,
  role: "regular" | "suspended admin" = "regular",
) {
  const db = owner.worker.database.owner;
  const own = await createCalendar();
  const foreign = await createCalendar();
  if (role === "suspended admin") {
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: own.users[0].id },
        data: { isAdmin: true },
      });
      await tx.userSuspension.create({
        data: {
          userId: own.users[0].id,
          reason: "Personal subscriptions remain available during suspension",
        },
      });
    });
  }
  const userIds = [...own.users, ...foreign.users].map(({ id }) => id);
  const stableRows = await db.userSectionSubscription.findMany({
    where: { userId: { in: userIds } },
    orderBy: [{ userId: "asc" }, { sectionId: "asc" }],
  });
  return {
    owner,
    own,
    foreign,
    stableRows,
    userIds,
    initial: [
      { userId: own.users[0].id, sectionId: own.section.id, kind: "regular" },
      {
        userId: foreign.users[0].id,
        sectionId: foreign.section.id,
        kind: "regular",
      },
    ] satisfies SubscriptionRelation[],
  };
}
type SubscriptionMutationFixture = Awaited<
  ReturnType<typeof createSubscriptionMutationFixture>
>;

// Observe only persisted memberships. Expected memberships are supplied by the
// test; neither a product read model nor a mutation response computes them.
export async function expectSubscriptionRelations(
  fixture: SubscriptionMutationFixture,
  expected: SubscriptionRelation[],
) {
  const db = fixture.owner.worker.database.owner;
  const actual = await db.userSectionSubscription.findMany({
    where: { userId: { in: fixture.userIds } },
    orderBy: [{ userId: "asc" }, { sectionId: "asc" }],
  });
  const ordered = (rows: SubscriptionRelation[]) =>
    [...rows].sort(
      (a, b) => a.userId.localeCompare(b.userId) || a.sectionId - b.sectionId,
    );
  expect(
    ordered(
      actual.map(({ userId, sectionId, kind }) => ({
        userId,
        sectionId,
        kind,
      })),
    ),
  ).toEqual(ordered(expected));
  // Original memberships must remain byte-for-byte equivalent, including their
  // creation timestamps. Snapshot preservation is distinct from outcome expectations.
  expect(
    actual.filter((row) =>
      fixture.stableRows.some(
        (stable) =>
          stable.userId === row.userId && stable.sectionId === row.sectionId,
      ),
    ),
  ).toEqual(fixture.stableRows);
}

export async function subscriptionGraphql(
  request: APIRequestContext,
  origin: string,
  query: string,
  variables: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  const response = await request.post("/api/graphql", {
    headers: { origin, ...headers },
    data: { query, variables },
  });
  return { response, body: await response.json() };
}

type SubscriptionConnection = {
  origin: string;
  transport: SubscriptionTransport | "anonymous";
  request: APIRequestContext;
  headers: Record<string, string>;
  client?: Client;
};

export async function runSubscriptionScenario(
  {
    page,
    oauthOwner: owner,
    createCalendar,
    calendarProtocolRun,
  }: {
    page: Page;
    oauthOwner: OAuthOwner;
    createCalendar: () => Promise<PrivateCalendar>;
    calendarProtocolRun: (
      work: (io: CalendarProtocol) => Promise<CalendarProtocolChecks>,
    ) => Promise<void>;
  },
  {
    transport = "anonymous",
    role = "regular",
    messages,
    scope = "workspace.subscription:read workspace.subscription:write",
    sdkTools = [],
  }: {
    transport?: SubscriptionConnection["transport"];
    role?: "regular" | "suspended admin";
    messages: number;
    scope?: string;
    sdkTools?: string[];
  },
  work: (
    connection: SubscriptionConnection,
    fixture: SubscriptionMutationFixture,
  ) => Promise<SubscriptionRelation[]>,
) {
  await calendarProtocolRun(async ({ request, mcp, observeCalendar }) => {
    const fixture = await createSubscriptionMutationFixture(
      owner,
      createCalendar,
      role,
    );
    const userId = fixture.own.users[0].id;
    await observeCalendar(
      fixture.own.users[0],
      Array.from({ length: messages }, () => ({ type: "user", userId })),
    );
    const headers: Record<string, string> = {};
    const origin = owner.worker.origin;
    let client: Client | undefined;
    if (transport !== "anonymous")
      await signInSubscriptionOwner(page, fixture.own, owner.worker);
    if (transport.endsWith("bearer")) {
      const token = await authorizeSubscription(page, request, owner, {
        scope,
        channel: transport.startsWith("REST")
          ? "rest"
          : transport.startsWith("GraphQL")
            ? "graphql"
            : "mcp",
      });
      headers.Authorization = `Bearer ${token}`;
      if (transport === "MCP bearer")
        client = await mcp({ name: "subscription-state-test", version: "1" }, token);
    }
    const expected = await work(
      {
        origin,
        transport,
        headers,
        client,
        request: transport.endsWith("session") ? page.request : request,
      },
      fixture,
    );
    return {
      async verifyTransport(observation) {
        expectSubscriptionProtocol(observation, sdkTools);
      },
      async verifyState() {
        await expectSubscriptionRelations(fixture, expected);
        for (const calendar of [fixture.own, fixture.foreign])
          await expectSubscriptionState(
            calendar,
            owner.worker,
            expected
              .filter(({ userId }) => userId === calendar.users[0].id)
              .map(({ sectionId, kind }) => ({ sectionId, kind })),
          );
      },
    };
  });
}

// Each branch retains its native response contract. Only the operation and
// fixture identifiers are shared; errors are deliberately not normalized.
export async function mutateSubscription(
  connection: SubscriptionConnection,
  fixture: SubscriptionMutationFixture,
  action: "add" | "remove" | "kind",
  wasSubscribed: boolean,
) {
  const { own, foreign } = fixture;
  const { transport, request, headers, client, origin } = connection;
  if (transport.startsWith("REST")) {
    const response =
      action === "kind"
        ? await request.patch(
            `/api/workspace/subscriptions/${foreign.section.jwId}`,
            { headers, data: { kind: "auditor" } },
          )
        : await request[action === "add" ? "patch" : "delete"](
            "/api/workspace/subscriptions",
            {
              headers,
              data: {
                sectionIds: [foreign.section.id],
                userId: foreign.users[0].id,
              },
            },
          );
    expect(response.status()).toBe(200);
    const body = await response.json();
    if (action === "kind") {
      expect(body).toEqual({
        sectionJwId: foreign.section.jwId,
        kind: "auditor",
      });
    } else {
      expect(body.subscription.userId).toBe(own.users[0].id);
      expect(
        body.subscription.sections
          .map((section: { id: number }) => section.id)
          .sort(),
      ).toEqual(
        (action === "add"
          ? [own.section.id, foreign.section.id]
          : [own.section.id]
        ).sort(),
      );
      if (action === "add") {
        expect(body).toMatchObject({
          addedCount: wasSubscribed ? 0 : 1,
          alreadySubscribedCount: wasSubscribed ? 1 : 0,
        });
      }
    }
    return;
  }
  if (transport.startsWith("GraphQL")) {
    const field =
      action === "kind"
        ? "subscriptionKindUpdate"
        : action === "add"
          ? "subscriptionAdd"
          : "subscriptionRemove";
    const { response, body } = await subscriptionGraphql(
      request,
      origin,
      `mutation($jwId: Int!) { ${field}(jwId: $jwId${action === "kind" ? ", kind: auditor" : ""}) { ${action === "kind" ? "sectionJwId kind" : "subscribed"} } }`,
      { jwId: foreign.section.jwId },
      headers,
    );
    expect(response.status()).toBe(200);
    expect(body.errors).toBeUndefined();
    expect(body.data[field]).toEqual(
      action === "kind"
        ? { sectionJwId: foreign.section.jwId, kind: "auditor" }
        : { subscribed: action === "add" },
    );
    return;
  }
  if (!client) throw new Error("MCP connection is required");
  const result = await client.callTool({
    name: `workspace_subscription_${action === "kind" ? "kind_update" : action}`,
    arguments: {
      jwId: foreign.section.jwId,
      userId: foreign.users[0].id,
      ...(action === "kind" ? { kind: "auditor" } : {}),
    },
  });
  expect(result.isError).not.toBe(true);
  expect(parseTextContent(result)).toMatchObject(
    action === "kind"
      ? { success: true, sectionJwId: foreign.section.jwId, kind: "auditor" }
      : {
          success: true,
          sectionJwId: foreign.section.jwId,
          action:
            action === "add"
              ? wasSubscribed
                ? "already_subscribed"
                : "subscribed"
              : wasSubscribed
                ? "unsubscribed"
                : "not_subscribed",
        },
  );
}

export async function expectMissingSubscriptionKind(
  connection: SubscriptionConnection,
  jwId: number,
) {
  const { transport, request, headers, client, origin } = connection;
  if (transport.startsWith("REST")) {
    const response = await request.patch(
      `/api/workspace/subscriptions/${jwId}`,
      {
        headers,
        data: { kind: "auditor" },
      },
    );
    await response.body();
    expect(response.status()).toBe(404);
  } else if (transport.startsWith("GraphQL")) {
    const { response, body } = await subscriptionGraphql(
      request,
      origin,
      "mutation($jwId: Int!) { subscriptionKindUpdate(jwId: $jwId, kind: auditor) { kind } }",
      { jwId },
      headers,
    );
    expect(response.status()).toBe(200);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].extensions.code).toBe("NOT_FOUND");
    expect(body.data).toBeNull();
  } else {
    if (!client) throw new Error("MCP connection is required");
    const result = await client.callTool({
      name: "workspace_subscription_kind_update",
      arguments: { jwId, kind: "auditor" },
    });
    expect(result.isError).not.toBe(true);
    expect(parseTextContent(result)).toMatchObject({
      success: false,
      error: "not_found",
    });
  }
}
