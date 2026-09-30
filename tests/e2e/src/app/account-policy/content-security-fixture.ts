import { expect, type Page } from "@playwright/test";
import { test as communityTest } from "../../../utils/community-fixture";
import type {
  CommunityChecks,
  CommunityFlow,
} from "../../../utils/community-flow";
import type { IsolatedWorker } from "../../../utils/isolated-worker";
import { authorizeDeviceBearer } from "../../../utils/oauth-device-bearer";
import {
  expectOAuthUsage,
  type OAuthUsageWindow,
} from "../../../utils/oauth-usage";

const scope = "community.comment:write";
const deviceGrant = "urn:ietf:params:oauth:grant-type:device_code";
type Channel = "rest" | "graphql" | "mcp";
type Principal = "session" | Channel;

async function prepareCommentSecurity(
  page: Page,
  worker: IsolatedWorker,
  flow: CommunityFlow,
  userId: string,
  section: { id: number; jwId: number },
) {
  const db = worker.database.owner;
  const marker = `comment-security-${crypto.randomUUID()}`;
  const origin = worker.origin;
  const stable = () =>
    db.$transaction(async (tx) => ({
      users: await tx.user.findMany({ orderBy: { id: "asc" } }),
      sessions: await tx.session.findMany({ orderBy: { id: "asc" } }),
      semesters: await tx.semester.findMany({ orderBy: { id: "asc" } }),
      courses: await tx.course.findMany({ orderBy: { id: "asc" } }),
      sections: await tx.section.findMany({ orderBy: { id: "asc" } }),
      teachers: await tx.teacher.findMany({ orderBy: { id: "asc" } }),
      memberships: await tx.userSectionSubscription.findMany(),
      homework: await tx.homework.findMany(),
      todos: await tx.todo.findMany(),
      descriptions: await tx.description.findMany(),
      reactions: await tx.commentReaction.findMany(),
      uploads: await tx.upload.findMany(),
      pendingUploads: await tx.uploadPending.findMany(),
      attachments: await tx.commentAttachment.findMany(),
    }));
  const baseline = await stable();
  expect(baseline.users).toHaveLength(1);
  expect(baseline.users[0]).toMatchObject({
    id: userId,
    calendarFeedToken: null,
  });
  expect(baseline.sessions).toHaveLength(1);
  expect(baseline.sessions[0].userId).toBe(userId);
  const sessionId = baseline.sessions[0].id;
  const clients = await db.$transaction(async (tx) => {
    const create = (channel: Channel) =>
      tx.oAuthClient.create({
        data: {
          name: `${marker}-${channel}`,
          clientId: crypto.randomUUID(),
          clientSecret: crypto.randomUUID(),
          redirectUris: [`${origin}/oauth-e2e/callback`],
          type: "public",
          tokenEndpointAuthMethod: "none",
          disabled: false,
          scopes: [scope],
          grantTypes: [deviceGrant],
          responseTypes: ["code"],
          requirePKCE: true,
          metadata: { source: "e2e_fixture" },
        },
      });
    return {
      rest: await create("rest"),
      graphql: await create("graphql"),
      mcp: await create("mcp"),
    };
  });
  const token = await authorizeDeviceBearer(
    page.request,
    origin,
    clients.rest.clientId,
    scope,
  );
  const mcpToken = await authorizeDeviceBearer(
    page.request,
    origin,
    clients.mcp.clientId,
    scope,
    "/api/mcp",
  );
  const graphqlToken = await authorizeDeviceBearer(
    page.request,
    origin,
    clients.graphql.clientId,
    scope,
    "/api/graphql",
  );
  const mcp = await flow.mcp(
    { name: "comment-security", version: "1.0.0" },
    mcpToken,
  );
  const commentIds: Partial<Record<Principal, string>> = {};
  const windows: Record<Channel, OAuthUsageWindow[]> = {
    rest: [],
    graphql: [],
    mcp: [],
  };
  let suspension:
    | Awaited<ReturnType<typeof db.userSuspension.create>>
    | undefined;
  let createdComments:
    | Awaited<ReturnType<typeof db.comment.findMany>>
    | undefined;
  const checks: CommunityChecks = {
    async verifyTransport({ producer, sdkRequests }) {
      for (const [method, path, statuses] of [
        ["POST", "/api/auth/oauth2/device-authorization", [200, 200, 200]],
        ["POST", "/oauth/device", [303, 303, 303]],
        ["POST", "/api/auth/oauth2/token", [200, 200, 200]],
        ["POST", "/api/community/comments", [201, 201, 403, 403]],
        ["POST", "/api/graphql", [200, 403]],
        ["POST", "/api/account/preferences", [200, 200]],
      ] as const) {
        expect(
          producer.requests
            .filter(
              ({ value }) => value.method === method && value.path === path,
            )
            .map(({ result }) => result)
            .sort(),
        ).toEqual([...statuses].sort());
      }
      expect(
        producer.requests
          .filter(({ value }) => value.method !== "GET")
          .map(({ value }) => value.path)
          .sort(),
      ).toEqual(
        [
          ...Array<string>(3).fill("/api/auth/oauth2/device-authorization"),
          ...Array<string>(3).fill("/oauth/device"),
          ...Array<string>(3).fill("/api/auth/oauth2/token"),
          ...Array<string>(4).fill("/api/community/comments"),
          ...Array<string>(2).fill("/api/graphql"),
          ...Array<string>(2).fill("/api/account/preferences"),
          ...Array<string>(4).fill("/api/mcp"),
        ].sort(),
      );
      expect(
        sdkRequests
          .map(({ method, rpc }) => `${method} ${rpc ?? "stream"}`)
          .sort(),
      ).toEqual([
        "GET stream",
        "POST initialize",
        "POST notifications/initialized",
        "POST tools/call",
        "POST tools/call",
      ]);
      expect(
        sdkRequests
          .filter(({ rpc }) => rpc === "tools/call")
          .map(({ tool }) => tool),
      ).toEqual(["community_comment_create", "community_comment_create"]);
    },
    async verifyState() {
      expect(await stable()).toEqual(baseline);
      expect(await db.userSuspension.findMany()).toEqual([suspension]);
      expect(suspension).toMatchObject({
        userId,
        reason: marker,
        createdById: null,
        note: null,
        expiresAt: null,
        liftedAt: null,
        liftedById: null,
      });
      const principals = ["session", "rest", "graphql", "mcp"] as const;
      expect(Object.keys(commentIds).sort()).toEqual([...principals].sort());
      const comments = await db.comment.findMany({ orderBy: { id: "asc" } });
      expect(comments).toEqual(createdComments);
      expect(
        comments.map(({ createdAt, updatedAt, ...row }) => {
          expect(createdAt).toEqual(expect.any(Date));
          expect(updatedAt).toEqual(expect.any(Date));
          return row;
        }),
      ).toEqual(
        principals
          .map((principal) => ({
            id: commentIds[principal],
            body: marker,
            visibility: "public",
            status: "active",
            isAnonymous: false,
            authorName: null,
            deletedAt: null,
            moderatedAt: null,
            moderationNote: null,
            userId,
            moderatedById: null,
            parentId: null,
            rootId: commentIds[principal],
            sectionId: section.id,
            courseId: null,
            teacherId: null,
            sectionTeacherId: null,
            homeworkId: null,
            youngEventId: null,
          }))
          .sort((a, b) => (a.id as string).localeCompare(b.id as string)),
      );
      expect(
        await db.oAuthClient.findMany({ orderBy: { clientId: "asc" } }),
      ).toEqual(
        Object.values(clients).sort((a, b) =>
          a.clientId.localeCompare(b.clientId),
        ),
      );
      const consents = await db.oAuthConsent.findMany({
        orderBy: { clientId: "asc" },
      });
      expect(
        consents.map(
          ({
            clientId,
            userId,
            grantId,
            scopes,
            resources,
            requestedUserInfoClaims,
          }) => ({
            clientId,
            userId,
            grantId,
            scopes,
            resources,
            requestedUserInfoClaims,
          }),
        ),
      ).toEqual(
        (
          [
            ["rest", "/api/auth"],
            ["graphql", "/api/graphql"],
            ["mcp", "/api/mcp"],
          ] as const
        )
          .map(([channel, path]) => ({
            clientId: clients[channel].clientId,
            userId,
            grantId: expect.any(String),
            scopes: [scope],
            resources: [`${origin}${path}`],
            requestedUserInfoClaims: [],
          }))
          .sort((a, b) => a.clientId.localeCompare(b.clientId)),
      );
      for (const consent of consents)
        expect(consent.grantId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
      expect(new Set(consents.map(({ grantId }) => grantId)).size).toBe(3);
      expect(await db.deviceCode.count()).toBe(0);
      expect(await db.oAuthAccessToken.count()).toBe(0);
      expect(await db.oAuthRefreshToken.count()).toBe(0);
      const audits = await db.auditLog.findMany({
        orderBy: { targetId: "asc" },
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
      });
      expect(audits).toEqual(
        principals
          .map((principal) => ({
            action: "comment_create",
            outcome: "success",
            userId,
            subjectUserId: userId,
            targetId: commentIds[principal],
            targetType: "comment",
            channel: principal === "session" ? "rest" : principal,
            oauthClientId:
              principal === "session" ? null : clients[principal].clientId,
            oauthGrantId:
              principal === "session"
                ? null
                : consents.find(
                    ({ clientId }) => clientId === clients[principal].clientId,
                  )?.grantId,
            sessionId: principal === "session" ? sessionId : null,
            metadata:
              principal === "graphql" || principal === "mcp"
                ? { source: principal }
                : null,
          }))
          .sort((a, b) =>
            (a.targetId as string).localeCompare(b.targetId as string),
          ),
      );
      const usage = await db.oAuthGrantUsageDaily.findMany({
        orderBy: { day: "asc" },
      });
      expect(
        usage.every(({ clientId }) =>
          Object.values(clients).some((client) => client.clientId === clientId),
        ),
      ).toBe(true);
      for (const channel of ["rest", "graphql", "mcp"] as const) {
        const clientId = clients[channel].clientId;
        expectOAuthUsage(
          usage.filter((row) => row.clientId === clientId),
          {
            dimensions: {
              userId,
              clientId,
              grantId: consents.find((row) => row.clientId === clientId)
                ?.grantId,
              feature: "community.comment",
              channel,
            },
            counts: [0, 2, channel === "mcp" ? 0 : 1],
            windows: windows[channel],
          },
        );
      }
    },
  };
  return {
    db,
    marker,
    userId,
    section,
    scope,
    clients,
    token,
    graphqlToken,
    mcp,
    commentIds,
    checks,
    async measure<T>(channel: Channel, error: boolean, work: () => Promise<T>) {
      const start = Date.now();
      const result = await work();
      windows[channel].push({
        start,
        end: Date.now(),
        operation: error ? "write error" : "write",
      });
      return result;
    },
    async suspend() {
      createdComments = await db.comment.findMany({ orderBy: { id: "asc" } });
      suspension = await db.userSuspension.create({
        data: { userId, reason: marker },
      });
    },
  };
}

type CommentSecurity = Awaited<ReturnType<typeof prepareCommentSecurity>>;
export const test = communityTest.extend<{
  commentSecurityRun: (
    work: (fixture: CommentSecurity) => Promise<void>,
  ) => Promise<void>;
}>({
  commentSecurityRun: async (
    { page, isolatedWorker, communityFlow, account, community },
    use,
  ) => {
    await use(async (work) => {
      let fixture: CommentSecurity;
      await communityFlow.run(
        async () => {
          fixture = await prepareCommentSecurity(
            page,
            isolatedWorker,
            communityFlow,
            account.id,
            community.section,
          );
          await work(fixture);
        },
        { auditActions: { comment_create: 4 } },
        {
          verifyTransport: (observation) =>
            fixture.checks.verifyTransport(observation),
          verifyState: () => fixture.checks.verifyState(),
        },
      );
    });
  },
});
