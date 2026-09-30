import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { type APIRequestContext, expect, type Page } from "@playwright/test";
import {
  issueAccessTokenForClient,
  type OAuthOwner,
  parseTextContent,
  registerPublicClient,
} from "../src/app/api/mcp/helpers";
import type {
  CalendarProtocol,
  CalendarProtocolChecks,
} from "./calendar-protocol-lifecycle";
import { expectOAuthUsage, type OAuthUsageWindow } from "./oauth-usage";
import type { PrivateCalendar } from "./private-calendar-fixture";

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

async function createSubscriptionMutationFixture(
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
  operation: <T>(
    kind: OAuthUsageWindow["operation"],
    work: () => Promise<T>,
  ) => Promise<T>;
};

// Preserve whole relevant rows, including unrelated calendar owners and sources.
async function observeStableState(owner: OAuthOwner) {
  return owner.worker.database.owner.$transaction(async (tx) => ({
    users: await tx.user.findMany({ orderBy: { id: "asc" } }),
    suspensions: await tx.userSuspension.findMany({ orderBy: { id: "asc" } }),
    todos: await tx.todo.findMany({ orderBy: { id: "asc" } }),
    youngSubscriptions: await tx.userYoungEventSubscription.findMany({
      orderBy: [{ userId: "asc" }, { youngId: "asc" }],
    }),
    youngEvents: await tx.youngEvent.findMany({ orderBy: { youngId: "asc" } }),
    homework: await tx.homework.findMany({ orderBy: { id: "asc" } }),
    homeworkCompletions: await tx.homeworkCompletion.findMany({
      orderBy: [{ userId: "asc" }, { homeworkId: "asc" }],
    }),
    semesters: await tx.semester.findMany({ orderBy: { id: "asc" } }),
    courses: await tx.course.findMany({ orderBy: { id: "asc" } }),
    sections: await tx.section.findMany({ orderBy: { id: "asc" } }),
    groups: await tx.scheduleGroup.findMany({ orderBy: { id: "asc" } }),
    schedules: await tx.schedule.findMany({ orderBy: { id: "asc" } }),
    exams: await tx.exam.findMany({ orderBy: { id: "asc" } }),
  }));
}

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
    usage,
    scope = "workspace.subscription:read workspace.subscription:write",
    sdkTools = [],
  }: {
    transport?: SubscriptionConnection["transport"];
    role?: "regular" | "suspended admin";
    messages: 0 | 4;
    usage: readonly [read: number, write: number, error: number];
    scope?: string;
    sdkTools?: string[];
  },
  work: (
    connection: SubscriptionConnection,
    fixture: SubscriptionMutationFixture,
  ) => Promise<void>,
) {
  await calendarProtocolRun(async ({ request, mcp, observeCalendar }) => {
    const fixture = await createSubscriptionMutationFixture(
      owner,
      createCalendar,
      role,
    );
    const db = owner.worker.database.owner;
    const userId = fixture.own.users[0].id;
    await observeCalendar(
      fixture.own.users[0],
      Array.from({ length: messages }, () => ({ type: "user", userId })),
    );
    const stableState = await observeStableState(owner);
    const headers: Record<string, string> = {};
    const origin = owner.worker.origin;
    const bearer = transport.endsWith("bearer");
    const resource = `${origin}/api/${transport.startsWith("REST") ? "auth" : transport.startsWith("GraphQL") ? "graphql" : "mcp"}`;
    let sessionId: string | undefined;
    let clientId: string | undefined;
    let client: Client | undefined;
    if (transport !== "anonymous") {
      await page
        .context()
        .addCookies([
          (await owner.worker.createSession(userId)).cookie,
          { name: "NEXT_LOCALE", value: "en-us", url: origin },
        ]);
      const sessions = await db.session.findMany({
        select: { id: true, userId: true },
      });
      expect(sessions).toEqual([{ id: expect.any(String), userId }]);
      sessionId = sessions[0].id;
    }
    const clientScopes = [
      "workspace.subscription:read",
      "workspace.subscription:write",
    ];
    if (bearer) {
      clientId = await registerPublicClient(request, scope, owner);
      // DCR registers the public capability set; its policy has separate tests.
      // Arrange this client's capabilities before genuine consent. Even a
      // read-only grant belongs to a client capable of requesting writes.
      await db.oAuthClient.update({
        where: { clientId },
        data: { scopes: clientScopes },
      });
      const { response, tokenBody } = await issueAccessTokenForClient(
        page,
        request,
        {
          clientId,
          owner,
          scope,
          resource,
        },
      );
      expect(response.status()).toBe(200);
      expect(typeof tokenBody.access_token).toBe("string");
      expect(tokenBody.refresh_token).toBeUndefined();
      expect(tokenBody).not.toHaveProperty("id_token");
      headers.Authorization = `Bearer ${tokenBody.access_token}`;
      if (transport === "MCP bearer")
        client = await mcp(
          { name: "subscription-state-test", version: "1" },
          tokenBody.access_token as string,
        );
    }
    const windows: OAuthUsageWindow[] = [];
    await work(
      {
        origin,
        transport,
        headers,
        client,
        request: transport.endsWith("session") ? page.request : request,
        async operation(operation, action) {
          const start = Date.now();
          const result = await action();
          if (bearer) windows.push({ start, end: Date.now(), operation });
          return result;
        },
      },
      fixture,
    );
    return {
      async verifyTransport({ effects, sdkRequests }) {
        for (const [method, path, status] of [
          ["POST", "/api/auth/oauth2/register", 201],
          ["GET", "/api/auth/oauth2/authorize", 302],
          ["POST", "/oauth/authorize", 200],
          ["POST", "/api/auth/oauth2/token", 200],
        ] as const) {
          const observed = effects.requests.filter(
            ({ value }) => value.method === method && value.path === path,
          );
          expect(observed).toHaveLength(bearer ? 1 : 0);
          for (const request of observed) expect(request.result).toBe(status);
        }
        expect(
          sdkRequests
            .map((request) => `${request.method} ${request.rpc ?? "stream"}`)
            .sort(),
        ).toEqual(
          transport === "MCP bearer"
            ? [
                "GET stream",
                "POST initialize",
                "POST notifications/initialized",
                ...sdkTools.map(() => "POST tools/call"),
              ]
            : [],
        );
        expect(
          sdkRequests
            .filter((request) => request.rpc === "tools/call")
            .map((request) => request.tool),
        ).toEqual(sdkTools);
      },
      async verifyState() {
        await expectSubscriptionRelations(fixture, fixture.initial);
        expect(await observeStableState(owner)).toEqual(stableState);
        expect(
          await db.user.findMany({
            orderBy: { id: "asc" },
            select: { id: true, calendarFeedToken: true },
          }),
        ).toEqual(
          fixture.userIds
            .map((id) => ({ id, calendarFeedToken: null }))
            .sort((a, b) => a.id.localeCompare(b.id)),
        );
        expect(
          await db.session.findMany({ select: { id: true, userId: true } }),
        ).toEqual(sessionId ? [{ id: sessionId, userId }] : []);
        expect(
          await db.oAuthClient.findMany({
            select: {
              clientId: true,
              name: true,
              userId: true,
              scopes: true,
              redirectUris: true,
              grantTypes: true,
              responseTypes: true,
              tokenEndpointAuthMethod: true,
              applicationType: true,
            },
          }),
        ).toEqual(
          clientId
            ? [
                {
                  clientId,
                  name: owner.clientNames[0],
                  userId: null,
                  scopes: clientScopes,
                  redirectUris: [`${origin}/e2e/oauth/callback`],
                  grantTypes: ["authorization_code"],
                  responseTypes: ["code"],
                  tokenEndpointAuthMethod: "none",
                  applicationType: "native",
                },
              ]
            : [],
        );
        expect(owner.clientNames).toHaveLength(bearer ? 1 : 0);
        const consents = await db.oAuthConsent.findMany({
          select: {
            clientId: true,
            userId: true,
            grantId: true,
            scopes: true,
            resources: true,
            requestedUserInfoClaims: true,
          },
        });
        expect(consents).toEqual(
          clientId
            ? [
                {
                  clientId,
                  userId,
                  grantId: expect.any(String),
                  scopes: scope.split(" "),
                  resources: [resource],
                  requestedUserInfoClaims: [],
                },
              ]
            : [],
        );
        const grantId = consents[0]?.grantId;
        if (clientId)
          expect(grantId).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
          );
        expect(
          await db.auditLog.findMany({
            select: {
              action: true,
              outcome: true,
              channel: true,
              userId: true,
              subjectUserId: true,
              targetId: true,
              targetType: true,
              oauthClientId: true,
              oauthGrantId: true,
              sessionId: true,
              metadata: true,
            },
          }),
        ).toEqual(
          clientId
            ? [
                {
                  action: "oauth_authorization_grant",
                  outcome: "success",
                  channel: "web",
                  userId,
                  subjectUserId: userId,
                  targetId: clientId,
                  targetType: "oauth_client",
                  oauthClientId: clientId,
                  oauthGrantId: grantId,
                  sessionId,
                  metadata: {
                    changedFields: ["resources", "scopes", "userinfoClaims"],
                    resourceCount: 1,
                    scopeCount: scope.split(" ").length,
                  },
                },
              ]
            : [],
        );
        expect(await db.oAuthRefreshToken.count()).toBe(0);
        expect(await db.oAuthAccessToken.count()).toBe(0);
        // Resource access tokens are JWTs; issuance is asserted at the real
        // exchange above, not inferred from opaque-token persistence.
        const rows = await db.oAuthGrantUsageDaily.findMany({
          orderBy: { day: "asc" },
          select: {
            userId: true,
            clientId: true,
            grantId: true,
            grantKey: true,
            day: true,
            feature: true,
            channel: true,
            readCount: true,
            writeCount: true,
            errorCount: true,
            lastUsedAt: true,
          },
        });
        expectOAuthUsage(rows, {
          counts: usage,
          windows,
          dimensions: {
            userId,
            clientId,
            grantId,
            feature: "workspace.subscription",
            channel: transport.startsWith("REST")
              ? "rest"
              : transport.startsWith("GraphQL")
                ? "graphql"
                : "mcp",
          },
        });
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
  wasSubscribed = true,
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
    const { body } = await subscriptionGraphql(
      request,
      origin,
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
