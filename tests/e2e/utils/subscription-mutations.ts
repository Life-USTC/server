import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { type APIRequestContext, expect, type Page } from "@playwright/test";
import {
  issueAccessTokenForClient,
  parseTextContent,
  registerPublicClient,
} from "../src/app/api/mcp/helpers";
import { createCalendarContractFixture } from "./calendar-contract";
import { PLAYWRIGHT_BASE_URL } from "./e2e-db/core";
import { withE2ePrisma } from "./e2e-db/prisma";
import { createSignedSessionCookie } from "./workspace-task-filters";

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
  role: "regular" | "suspended admin" = "regular",
) {
  const own = await createCalendarContractFixture();
  let foreign:
    | Awaited<ReturnType<typeof createCalendarContractFixture>>
    | undefined;
  const cleanup = async () => {
    const results = await Promise.allSettled([
      own.cleanup(),
      foreign?.cleanup(),
    ]);
    const errors = results.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    );
    if (errors.length)
      throw new AggregateError(errors, "Subscription fixture cleanup failed");
  };
  try {
    foreign = await createCalendarContractFixture();
    if (role === "suspended admin") {
      await withE2ePrisma(async (db) => {
        await db.user.update({
          where: { id: own.users[0].id },
          data: { isAdmin: true },
        });
        await db.userSuspension.create({
          data: {
            userId: own.users[0].id,
            reason: "Personal subscriptions remain available during suspension",
          },
        });
      });
    }
    const userIds = [...own.users, ...foreign.users].map(({ id }) => id);
    const stableRows = await withE2ePrisma((db) =>
      db.userSectionSubscription.findMany({
        where: {
          userId: { in: userIds },
        },
        orderBy: [{ userId: "asc" }, { sectionId: "asc" }],
      }),
    );
    return {
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
      cleanup,
    };
  } catch (error) {
    try {
      await cleanup();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Subscription fixture setup and cleanup failed",
      );
    }
    throw error;
  }
}
export type SubscriptionMutationFixture = Awaited<
  ReturnType<typeof createSubscriptionMutationFixture>
>;

// Observe only persisted memberships. Expected memberships are supplied by the
// test; neither a product read model nor a mutation response computes them.
export async function expectSubscriptionRelations(
  fixture: SubscriptionMutationFixture,
  expected: SubscriptionRelation[],
) {
  const actual = await withE2ePrisma((db) =>
    db.userSectionSubscription.findMany({
      where: { userId: { in: fixture.userIds } },
      orderBy: [{ userId: "asc" }, { sectionId: "asc" }],
    }),
  );
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
  query: string,
  variables: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  const response = await request.post("/api/graphql", {
    headers: { origin: PLAYWRIGHT_BASE_URL, ...headers },
    data: { query, variables },
  });
  return { response, body: await response.json() };
}

export async function openSubscriptionTransport(
  page: Page,
  anonymousRequest: APIRequestContext,
  userId: string,
  transport: SubscriptionTransport,
  scope = "workspace.subscription:read workspace.subscription:write",
) {
  await page
    .context()
    .addCookies([
      await createSignedSessionCookie(userId),
      { name: "NEXT_LOCALE", value: "en-us", url: PLAYWRIGHT_BASE_URL },
    ]);
  const resource = `${PLAYWRIGHT_BASE_URL}/api/${transport.startsWith("REST") ? "auth" : transport.startsWith("GraphQL") ? "graphql" : "mcp"}`;
  let clientId: string | undefined;
  let client: Client | undefined;
  const headers: Record<string, string> = {};
  const close = async () => {
    try {
      await client?.close();
    } finally {
      if (clientId) {
        await withE2ePrisma((db) =>
          db.oAuthClient.deleteMany({ where: { clientId } }),
        );
      }
    }
  };
  try {
    if (transport.endsWith("bearer")) {
      clientId = await registerPublicClient(anonymousRequest, scope);
      const { response, tokenBody } = await issueAccessTokenForClient(
        page,
        anonymousRequest,
        {
          clientId,
          scope,
          resource,
        },
      );
      expect(response.status()).toBe(200);
      expect(typeof tokenBody.access_token).toBe("string");
      headers.Authorization = `Bearer ${tokenBody.access_token}`;
    }
    const request = transport.endsWith("session")
      ? page.request
      : anonymousRequest;
    if (transport === "MCP bearer") {
      client = new Client({ name: "subscription-state-test", version: "1" });
      await client.connect(
        new StreamableHTTPClientTransport(new URL(resource), {
          requestInit: { headers },
        }),
      );
    }
    return {
      transport,
      request,
      headers,
      client,
      close,
    };
  } catch (error) {
    try {
      await close();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Subscription transport setup and cleanup failed",
      );
    }
    throw error;
  }
}
export type SubscriptionConnection = Awaited<
  ReturnType<typeof openSubscriptionTransport>
>;

// Each branch retains its native response contract. Only the operation and
// fixture identifiers are shared; errors are deliberately not normalized.
export async function mutateSubscription(
  connection: SubscriptionConnection,
  fixture: SubscriptionMutationFixture,
  action: "add" | "remove" | "kind",
  wasSubscribed = true,
) {
  const { own, foreign } = fixture;
  const { transport, request, headers, client } = connection;
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
          addedCount: 1,
          alreadySubscribedCount: 0,
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
              ? "subscribed"
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
  const { transport, request, headers, client } = connection;
  if (transport.startsWith("REST")) {
    const response = await request.patch(
      `/api/workspace/subscriptions/${jwId}`,
      {
        headers,
        data: { kind: "auditor" },
      },
    );
    expect(response.status()).toBe(404);
  } else if (transport.startsWith("GraphQL")) {
    const { body } = await subscriptionGraphql(
      request,
      "mutation($jwId: Int!) { subscriptionKindUpdate(jwId: $jwId, kind: auditor) { kind } }",
      { jwId },
      headers,
    );
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
