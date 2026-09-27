import { afterAll, beforeAll, expect, it } from "vitest";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { youngEventState } from "@/features/young/server/young-notification-state";
import { getYoungWorkspaceRoute } from "@/lib/api/routes/young-workspace-routes";
import { authPrisma } from "@/lib/db/auth-prisma";
import { prisma } from "@/lib/db/prisma";
import { createGraphqlYoga } from "@/lib/graphql/server";
import {
  getOAuthGraphqlResourceUrl,
  getOAuthRestAudienceUrls,
} from "@/lib/mcp/urls";
import type { PaginatedResponse } from "@/lib/pagination";
import { createFixturePrisma } from "../../../shared/prisma";
import { createMcpHarness, type McpHarness } from "../_harness/client";

const db = createFixturePrisma();
const users = [crypto.randomUUID(), crypto.randomUUID()];
const clientId = `young-pages-${crypto.randomUUID()}`;
const scopes = [
  "workspace.young-subscription:read",
  "workspace.young-notification:read",
];
const eventIds = Array.from(
  { length: 5 },
  () => `pages-${crypto.randomUUID()}`,
);
const organizerIds = Array.from({ length: 5 }, () => crypto.randomUUID());
const noticeIds = Array.from({ length: 7 }, () => crypto.randomUUID());
const now = new Date(Math.floor(Date.now() / 1000) * 1000 + 437);
const created = [0, 1, 1, 2, 3, 0, 0].map(
  (days) => new Date(now.getTime() - days * 86_400_000),
);
let grantId: string;
let client: McpHarness;

beforeAll(async () => {
  await db.user.createMany({
    data: users.map((id) => ({
      id,
      name: "Young page reader",
      email: `${id}@test.invalid`,
    })),
  });
  await db.oAuthClient.create({
    data: {
      clientId,
      name: "Young pages",
      scopes,
      redirectUris: ["https://client.example/callback"],
    },
  });
  grantId = (
    await db.oAuthConsent.create({
      data: { clientId, userId: users[0], scopes },
    })
  ).grantId;
  client = await createMcpHarness(users[0], scopes);
  // Reverse insertion makes ordering assertions independent of insertion order.
  for (const i of [4, 3, 2, 1, 0]) {
    await db.youngOrganizer.create({
      data: {
        id: organizerIds[i],
        name: `Organizer ${i}`,
        normalizedName: organizerIds[i],
      },
    });
    const event = await db.youngEvent.create({
      data: {
        youngId: eventIds[i],
        organizerId: organizerIds[i],
        name: `Event ${i}`,
        rawJson: {},
        isActive: i % 2 === 0,
      },
    });
    await db.userYoungEventSubscription.create({
      data: {
        userId: users[0],
        youngId: eventIds[i],
        observedState: youngEventState(event),
        createdAt: created[i],
        remindSignup: false,
        remindDeadline: false,
        remindStart: false,
      },
    });
    await db.userYoungOrganizerSubscription.create({
      data: {
        userId: users[0],
        organizerId: organizerIds[i],
        createdAt: created[i],
      },
    });
  }
  await db.userYoungEventSubscription.create({
    data: {
      userId: users[1],
      youngId: eventIds[0],
      observedState: youngEventState(
        await db.youngEvent.findUniqueOrThrow({
          where: { youngId: eventIds[0] },
        }),
      ),
      remindSignup: false,
      remindDeadline: false,
      remindStart: false,
    },
  });
  await db.userYoungOrganizerSubscription.create({
    data: { userId: users[1], organizerId: organizerIds[0] },
  });
  await db.youngNotification.createMany({
    data: noticeIds.map((id, i) => ({
      id,
      userId: users[i === 6 ? 1 : 0],
      youngId: eventIds[i % 5],
      organizerId: organizerIds[i % 5],
      kind: "event_changed",
      title: `Notice ${i}`,
      body: `Detail ${i}`,
      dedupeKey: id,
      createdAt: created[i],
      readAt: i === 3 ? now : null,
      expiresAt:
        i === 5
          ? new Date(now.getTime() - 86_400_000)
          : i === 4
            ? new Date(now.getTime() + 86_400_000)
            : null,
    })),
  });
});
afterAll(async () => {
  await client?.close();
  await db.oAuthConsent.deleteMany({ where: { clientId } });
  await db.oAuthClient.deleteMany({ where: { clientId } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.youngEvent.deleteMany({ where: { youngId: { in: eventIds } } });
  await db.youngOrganizer.deleteMany({ where: { id: { in: organizerIds } } });
  await Promise.all([
    db.$disconnect(),
    prisma.$disconnect(),
    authPrisma.$disconnect(),
  ]);
});

async function request(path: string, graphBody?: unknown) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const audience = graphBody
    ? getOAuthGraphqlResourceUrl()
    : getOAuthRestAudienceUrls()[0];
  const token = await signResourceBoundOAuthAccessToken({
    clientId,
    userId: users[0],
    grantId,
    scopes,
    resources: [audience],
    issuedAt,
    expiresAt: issuedAt + 300,
  });
  if (!token) throw new Error("Expected signed resource token");
  return new Request(`https://example.test${path}`, {
    method: graphBody ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(graphBody ? { "Content-Type": "application/json" } : {}),
    },
    ...(graphBody ? { body: JSON.stringify(graphBody) } : {}),
  });
}
const ascendingTie = (ids: string[]) => [
  ids[0],
  ...ids.slice(1, 3).sort(),
  ...ids.slice(3, 5),
];
const descendingTie = [
  noticeIds[0],
  ...noticeIds.slice(1, 3).sort().reverse(),
  ...noticeIds.slice(3, 5),
];

type Row = Record<string, unknown>;
// REST/MCP use Shanghai timestamps; GraphQL DateTime uses UTC for Date values.
function timestampInstants(row: Row): Row {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      ["createdAt", "readAt", "expiresAt"].includes(key) &&
      typeof value === "string"
        ? new Date(value).getTime()
        : value,
    ]),
  );
}
it("young-workspace.list-transport-pagination", async () => {
  for (const spec of [
    {
      kind: "events",
      path: "young-event-subscriptions",
      field: "youngEventSubscriptions",
      tool: "workspace_young_event_subscription_list",
      id: "youngId",
      selection:
        "youngId createdAt remindSignup remindDeadline remindStart event { youngId name isActive organizerId }",
      expected: ascendingTie(eventIds),
      unread: undefined,
    },
    {
      kind: "organizers",
      path: "young-organizer-subscriptions",
      field: "youngOrganizerSubscriptions",
      tool: "workspace_young_organizer_subscription_list",
      id: "organizerId",
      selection: "organizerId createdAt organizer { id name }",
      expected: ascendingTie(organizerIds),
      unread: undefined,
    },
    ...[undefined, false, true].map((unread) => ({
      kind: "notifications",
      path: "young-notifications",
      field: "youngNotifications",
      tool: "workspace_young_notification_list",
      id: "id",
      selection:
        "id youngId organizerId kind title body createdAt readAt expiresAt",
      expected: unread
        ? descendingTie.filter((id) => id !== noticeIds[3])
        : descendingTie,
      unread,
    })),
  ] as const) {
    const joined: string[] = [];
    for (const page of [1, 2, 3, 4]) {
      const pageSize = 2;
      const filter = spec.unread === undefined ? {} : { unread: spec.unread };
      const query = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(spec.unread === undefined ? {} : { unread: String(spec.unread) }),
      });
      const response = await getYoungWorkspaceRoute(
        await request(`/api/workspace/${spec.path}?${query}`),
        spec.kind as "events" | "organizers" | "notifications",
      );
      expect(response.status).toBe(200);
      const rest = (await response.json()) as PaginatedResponse<Row>;
      const expectedIds = spec.expected.slice(
        (page - 1) * pageSize,
        page * pageSize,
      );
      expect(rest.data.map((row) => row[spec.id])).toEqual(expectedIds);
      expect(rest.pagination).toEqual({
        page,
        pageSize,
        total: spec.expected.length,
        totalPages: Math.ceil(spec.expected.length / pageSize),
      });
      const mcp = await client.call<
        PaginatedResponse<Row> & { success: boolean }
      >(spec.tool, {
        page,
        pageSize,
        ...filter,
        mode: "full",
      });
      expect(mcp).toEqual({ ...rest, success: true });
      const graphResponse = await createGraphqlYoga(false).fetch(
        await request("/api/graphql", {
          query: `query($page: PageInput!${spec.kind === "notifications" ? ", $unread: Boolean" : ""}) { workspace { ${spec.field}(page: $page${spec.kind === "notifications" ? ", unread: $unread" : ""}) { items { ${spec.selection} } pageInfo { page pageSize total totalPages } } } }`,
          variables: { page: { page, pageSize }, ...filter },
        }),
        { locals: { locale: "zh-cn" } },
      );
      const graph = await graphResponse.json();
      expect(graph.errors).toBeUndefined();
      const actual = graph.data.workspace[spec.field];
      expect(actual.pageInfo).toEqual(rest.pagination);
      expect(actual.items.map((row: Row) => row[spec.id])).toEqual(expectedIds);
      expect(rest.data.map(timestampInstants)).toMatchObject(
        actual.items.map(timestampInstants),
      );
      joined.push(...rest.data.map((row) => String(row[spec.id])));
    }
    expect(joined).toEqual(spec.expected);
    expect(new Set(joined).size).toBe(spec.expected.length);
  }
});
