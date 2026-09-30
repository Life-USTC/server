import {
  type APIRequestContext,
  type APIResponse,
  expect,
  type Page,
  type Request,
} from "@playwright/test";
import {
  issueAccessTokenForClient,
  type OAuthOwner,
  registerPublicClient,
} from "../src/app/api/mcp/helpers";
import type { CalendarProtocolObservation } from "./calendar-protocol-lifecycle";
import type { IsolatedWorker } from "./isolated-worker";
import { expectOAuthUsage, type OAuthUsageWindow } from "./oauth-usage";
import { gotoAndWaitForReady } from "./page-ready";
import type { PrivateCalendar } from "./private-calendar-fixture";

export type SubscriptionFixture = PrivateCalendar;
export const subscriptionSnapshotAt = "2026-04-29T09:30:00+08:00";
export const subscriptionOverviewUrl = `/workspace/overview?snapshotAt=${encodeURIComponent(subscriptionSnapshotAt)}`;

type SubscriptionSession = {
  id: string;
  userId: string;
  cookie: { name: string; value: string; url: string };
};

export async function useSubscriptionSession(
  page: Page,
  session: SubscriptionSession,
) {
  await page.context().clearCookies();
  await page
    .context()
    .addCookies([
      session.cookie,
      { name: "NEXT_LOCALE", value: "en-us", url: session.cookie.url },
    ]);
}

export async function signInSubscriptionOwner(
  page: Page,
  fixture: SubscriptionFixture,
  worker: IsolatedWorker,
): Promise<SubscriptionSession> {
  const db = worker.database.owner;
  const previous = await db.session.findMany({ select: { id: true } });
  const actor = await worker.createSession(fixture.users[0].id);
  const created = (
    await db.session.findMany({ select: { id: true, userId: true } })
  ).filter((session) => !previous.some(({ id }) => id === session.id));
  expect(created).toEqual([
    { id: expect.any(String), userId: fixture.users[0].id },
  ]);
  const session = { ...created[0], cookie: actor.cookie };
  await useSubscriptionSession(page, session);
  return session;
}

export async function observeSubscriptionRecords(worker: IsolatedWorker) {
  return worker.database.owner.$transaction(async (db) => ({
    users: await db.user.findMany({ orderBy: { id: "asc" } }),
    memberships: await db.userSectionSubscription.findMany({
      orderBy: [{ userId: "asc" }, { sectionId: "asc" }],
    }),
    sources: {
      suspensions: await db.userSuspension.findMany({ orderBy: { id: "asc" } }),
      todos: await db.todo.findMany({ orderBy: { id: "asc" } }),
      activities: await db.userYoungEventSubscription.findMany({
        orderBy: [{ userId: "asc" }, { youngId: "asc" }],
      }),
      youngEvents: await db.youngEvent.findMany({
        orderBy: { youngId: "asc" },
      }),
      homework: await db.homework.findMany({ orderBy: { id: "asc" } }),
      completions: await db.homeworkCompletion.findMany({
        orderBy: [{ userId: "asc" }, { homeworkId: "asc" }],
      }),
      semesters: await db.semester.findMany({ orderBy: { id: "asc" } }),
      courses: await db.course.findMany({ orderBy: { id: "asc" } }),
      sections: await db.section.findMany({ orderBy: { id: "asc" } }),
      groups: await db.scheduleGroup.findMany({ orderBy: { id: "asc" } }),
      schedules: await db.schedule.findMany({ orderBy: { id: "asc" } }),
      exams: await db.exam.findMany({ orderBy: { id: "asc" } }),
    },
  }));
}

type SubscriptionGrant = {
  clientId: string;
  clientName: string;
  accessToken: string;
  userId: string;
  sessionId: string;
  scope: "workspace.subscription:read" | "workspace.subscription:write";
  resource: string;
  channel: "rest" | "graphql" | "mcp";
  reads: number;
  writes: number;
  windows: OAuthUsageWindow[];
};

export async function authorizeSubscription(
  page: Page,
  request: APIRequestContext,
  owner: OAuthOwner,
  session: SubscriptionSession,
  expected: Pick<SubscriptionGrant, "scope" | "channel" | "reads" | "writes">,
): Promise<SubscriptionGrant> {
  const clientId = await registerPublicClient(request, expected.scope, owner);
  // Registration advertises the public capability set. This scenario prepares
  // a read/write-capable client independently of its read-only or write-only grant.
  await owner.worker.database.owner.oAuthClient.update({
    where: { clientId },
    data: {
      scopes: ["workspace.subscription:read", "workspace.subscription:write"],
    },
  });
  const resource = `${owner.worker.origin}/api/${expected.channel === "rest" ? "auth" : expected.channel}`;
  const { response, tokenBody } = await issueAccessTokenForClient(
    page,
    request,
    {
      owner,
      clientId,
      scope: expected.scope,
      resource,
    },
  );
  expect(response.status()).toBe(200);
  expect(typeof tokenBody.access_token).toBe("string");
  expect(tokenBody.refresh_token === undefined).toBe(true);
  expect("id_token" in tokenBody).toBe(false);
  return {
    ...expected,
    clientId,
    clientName: owner.clientNames[owner.clientNames.length - 1],
    accessToken: tokenBody.access_token as string,
    userId: session.userId,
    sessionId: session.id,
    resource,
    windows: [],
  };
}

export async function subscriptionCall<T>(
  grant: SubscriptionGrant,
  operation: OAuthUsageWindow["operation"],
  work: () => Promise<T>,
) {
  const start = Date.now();
  const result = await work();
  grant.windows.push({ start, end: Date.now(), operation });
  return result;
}

export async function verifySectionSubscriptionWrite(
  response: APIResponse,
  request: Request,
  jwId: number,
) {
  const url = new URL(request.url());
  expect(url.pathname).toBe(`/catalog/sections/${jwId}`);
  expect(["?/subscribe", "?/unsubscribe"]).toContain(url.search);
  expect(request.method()).toBe("POST");
  const body = await response.json();
  expect(response.status()).toBe(200);
  expect(body).toEqual({
    type: "redirect",
    status: 303,
    location: `/catalog/sections/${jwId}`,
  });
  return url.search;
}

export function expectSubscriptionProtocol(
  { effects, sdkRequests }: CalendarProtocolObservation,
  grants: number,
  tools: string[],
  connections: number,
) {
  for (const [method, path, status] of [
    ["POST", "/api/auth/oauth2/register", 201],
    ["GET", "/api/auth/oauth2/authorize", 302],
    ["POST", "/oauth/authorize", 200],
    ["POST", "/api/auth/oauth2/token", 200],
  ] as const) {
    const requests = effects.requests.filter(
      ({ value }) => value.method === method && value.path === path,
    );
    expect(requests).toHaveLength(grants);
    for (const request of requests) expect(request.result).toBe(status);
  }
  expect(
    sdkRequests
      .filter((request) => request.rpc === "tools/call")
      .map((request) => request.tool),
  ).toEqual(tools);
  expect(
    sdkRequests
      .map((request) => `${request.method} ${request.rpc ?? "stream"}`)
      .sort(),
  ).toEqual(
    [
      ...Array.from({ length: connections }, () => [
        "GET stream",
        "POST initialize",
        "POST notifications/initialized",
      ]).flat(),
      ...tools.map(() => "POST tools/call"),
    ].sort(),
  );
}

export async function expectSubscriptionRecords(
  worker: IsolatedWorker,
  baseline: Awaited<ReturnType<typeof observeSubscriptionRecords>>,
  expected: {
    memberships: (Omit<(typeof baseline.memberships)[number], "createdAt"> & {
      createdAt: Date | ReturnType<typeof expect.any>;
    })[];
    feedUsers: string[];
    sessions: SubscriptionSession[];
    grants: SubscriptionGrant[];
  },
) {
  const db = worker.database.owner;
  const actual = await observeSubscriptionRecords(worker);
  expect(actual.sources).toEqual(baseline.sources);
  expect(actual.memberships).toEqual(expected.memberships);
  expect(actual.users).toHaveLength(baseline.users.length);
  for (const [index, user] of actual.users.entries()) {
    const before = baseline.users[index];
    if (expected.feedUsers.includes(user.id)) {
      expect(user).toEqual({
        ...before,
        calendarFeedToken: expect.stringMatching(/^[A-Za-z0-9_-]{32}$/),
        updatedAt: expect.any(Date),
      });
      expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(
        before.updatedAt.getTime(),
      );
      expect(user.updatedAt.getTime()).toBeLessThanOrEqual(Date.now());
    } else expect(user).toEqual(before);
  }
  const order = <T extends { id: string }>(rows: T[]) =>
    [...rows].sort((a, b) => a.id.localeCompare(b.id));
  expect(
    await db.session.findMany({
      orderBy: { id: "asc" },
      select: { id: true, userId: true },
    }),
  ).toEqual(order(expected.sessions.map(({ id, userId }) => ({ id, userId }))));
  const byClient = (a: { clientId: string }, b: { clientId: string }) =>
    a.clientId.localeCompare(b.clientId);
  const grants = [...expected.grants].sort(byClient);
  expect(
    (
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
      })
    ).sort(byClient),
  ).toEqual(
    grants.map(({ clientId, clientName }) => ({
      clientId,
      name: clientName,
      userId: null,
      scopes: ["workspace.subscription:read", "workspace.subscription:write"],
      redirectUris: [`${worker.origin}/e2e/oauth/callback`],
      grantTypes: ["authorization_code"],
      responseTypes: ["code"],
      tokenEndpointAuthMethod: "none",
      applicationType: "native",
    })),
  );
  const consents = (
    await db.oAuthConsent.findMany({
      select: {
        clientId: true,
        userId: true,
        grantId: true,
        scopes: true,
        resources: true,
        requestedUserInfoClaims: true,
      },
    })
  ).sort(byClient);
  expect(consents).toEqual(
    grants.map((grant) => ({
      clientId: grant.clientId,
      userId: grant.userId,
      grantId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      ),
      scopes: [grant.scope],
      resources: [grant.resource],
      requestedUserInfoClaims: [],
    })),
  );
  const audits = [
    ...expected.feedUsers.map((userId) => ({
      action: "account_calendar_token_create",
      outcome: "success",
      channel: "system",
      userId,
      subjectUserId: userId,
      targetId: userId,
      targetType: "calendar_feed",
      oauthClientId: null,
      oauthGrantId: null,
      sessionId: null,
      metadata: null,
    })),
    ...grants.map((grant, index) => ({
      action: "oauth_authorization_grant",
      outcome: "success",
      channel: "web",
      userId: grant.userId,
      subjectUserId: grant.userId,
      targetId: grant.clientId,
      targetType: "oauth_client",
      oauthClientId: grant.clientId,
      oauthGrantId: consents[index].grantId,
      sessionId: grant.sessionId,
      metadata: {
        changedFields: ["resources", "scopes", "userinfoClaims"],
        resourceCount: 1,
        scopeCount: 1,
      },
    })),
  ];
  // Feed-token audits use the real audit queue, independently of calendar rebuilds.
  await expect
    .poll(() => db.auditLog.count(), {
      timeout: 15_000,
      message: "Subscription and feed-token audits persist",
    })
    .toBe(audits.length);
  const byAudit = (
    a: { action: string; targetId: string | null },
    b: { action: string; targetId: string | null },
  ) =>
    a.action.localeCompare(b.action) ||
    String(a.targetId).localeCompare(String(b.targetId));
  expect(
    (
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
      })
    ).sort(byAudit),
  ).toEqual(audits.sort(byAudit));
  expect(await db.oAuthAccessToken.count()).toBe(0);
  expect(await db.oAuthRefreshToken.count()).toBe(0);
  const usage = await db.oAuthGrantUsageDaily.findMany({
    orderBy: [{ clientId: "asc" }, { day: "asc" }],
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
  expect(
    usage.every((row) =>
      grants.some((grant) => row.clientId === grant.clientId),
    ),
  ).toBe(true);
  for (const [index, grant] of grants.entries()) {
    expectOAuthUsage(
      usage.filter((row) => row.clientId === grant.clientId),
      {
        dimensions: {
          userId: grant.userId,
          clientId: grant.clientId,
          grantId: consents[index].grantId,
          feature: "workspace.subscription",
          channel: grant.channel,
        },
        counts: [grant.reads, grant.writes, 0],
        windows: grant.windows,
      },
    );
  }
}

export async function observeSubscriptionState(
  fixture: SubscriptionFixture,
  worker: IsolatedWorker,
) {
  const db = worker.database.owner;
  return {
    sections: await db.userSectionSubscription.findMany({
      where: { userId: fixture.users[0].id },
      select: { sectionId: true, kind: true },
      orderBy: { sectionId: "asc" },
    }),
    todos: await db.todo.findMany({
      where: { userId: fixture.users[0].id },
      select: { id: true, title: true, completed: true },
      orderBy: { id: "asc" },
    }),
    activities: await db.userYoungEventSubscription.findMany({
      where: { userId: fixture.users[0].id },
      select: { youngId: true },
      orderBy: { youngId: "asc" },
    }),
  };
}

export function subscribedCourseLink(page: Page, fixture: SubscriptionFixture) {
  return page
    .getByTestId("subscription-course-link")
    .and(page.locator(`[href="/catalog/sections/${fixture.section.jwId}"]`))
    .filter({ visible: true });
}

export async function expectSubscribedWebProjections(
  page: Page,
  fixture: SubscriptionFixture,
  foreign?: SubscriptionFixture,
) {
  const expectOwnerIsolation = async () => {
    if (!foreign) return;
    await expect(page.locator("#main-content")).not.toContainText(
      String(foreign.course.nameEn),
    );
    await expect(page.locator("#main-content")).not.toContainText(
      foreign.todo.title,
    );
    await expect(page.locator("#main-content")).not.toContainText(
      foreign.young.name,
    );
  };
  await gotoAndWaitForReady(
    page,
    foreign
      ? `/workspace/subscriptions?userId=${foreign.users[0].id}`
      : "/workspace/subscriptions",
  );
  if (foreign) {
    await expect(
      page.locator(
        `a[data-testid="subscription-course-link"][href="/catalog/sections/${foreign.section.jwId}"]`,
      ),
    ).toHaveCount(0);
  }
  await expect(subscribedCourseLink(page, fixture)).toHaveText(
    String(fixture.course.nameEn),
  );
  await expectOwnerIsolation();
  await gotoAndWaitForReady(page, fixture.academicUrl());
  const calendar = page
    .locator(
      `#main-content a[href="/catalog/sections/${fixture.section.jwId}"]`,
    )
    .filter({ visible: true });
  await expect(calendar.first()).toContainText(String(fixture.course.nameEn));
  await expect(page.locator("#main-content")).toContainText("09:00");
  await expect(
    page
      .getByText(fixture.todo.title, { exact: true })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expect(
    page
      .getByText(fixture.young.name, { exact: true })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expectOwnerIsolation();
  await gotoAndWaitForReady(page, subscriptionOverviewUrl);
  const focus = page.getByTestId("workspace-overview-focus");
  await expect(focus.getByRole("link")).toHaveAttribute(
    "href",
    `/catalog/sections/${fixture.section.jwId}`,
  );
  await expect(focus).toContainText(String(fixture.course.nameEn));
  await expect(focus).toContainText("09:00-10:00");
  await expectOwnerIsolation();
}

export async function expectIndependentCalendarItems(
  page: Page,
  fixture: SubscriptionFixture,
) {
  await gotoAndWaitForReady(page, "/workspace/calendar");
  // Without course subscriptions the personal calendar owns its own date control.
  await page.locator("#personal-activity-date").fill(fixture.date);
  await expect(
    page
      .getByText(fixture.todo.title, { exact: true })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expect(
    page
      .getByText(fixture.young.name, { exact: true })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expect(page.locator("#main-content")).not.toContainText(
    String(fixture.course.nameEn),
  );
  await expect(page.locator("#main-content")).not.toContainText(
    fixture.homework.title,
  );
}
