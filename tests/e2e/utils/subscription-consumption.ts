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
import { gotoAndWaitForReady } from "./page-ready";
import type { PrivateCalendar } from "./private-calendar-fixture";

export type SubscriptionFixture = PrivateCalendar;
export const subscriptionSnapshotAt = "2026-04-29T09:30:00+08:00";
export const subscriptionOverviewUrl = `/workspace/overview?snapshotAt=${encodeURIComponent(subscriptionSnapshotAt)}`;

type SubscriptionSession = {
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
  const { cookie } = await worker.createSession(fixture.users[0].id);
  const session = { cookie };
  await useSubscriptionSession(page, session);
  return session;
}

// Consent uses the real authorization flow. OAuth persistence and usage accounting
// are covered by the dedicated OAuth contracts, not every subscription scenario.
export async function authorizeSubscription(
  page: Page,
  request: APIRequestContext,
  owner: OAuthOwner,
  {
    scope,
    channel,
  }: {
    scope: string;
    channel: "rest" | "graphql" | "mcp";
  },
) {
  const clientId = await registerPublicClient(request, scope, owner);
  await owner.worker.database.owner.oAuthClient.update({
    where: { clientId },
    data: {
      scopes: ["workspace.subscription:read", "workspace.subscription:write"],
    },
  });
  const { response, tokenBody } = await issueAccessTokenForClient(
    page,
    request,
    {
      owner,
      clientId,
      scope,
      resource: `${owner.worker.origin}/api/${channel === "rest" ? "auth" : channel}`,
    },
  );
  expect(response.status()).toBe(200);
  expect(typeof tokenBody.access_token).toBe("string");
  return tokenBody.access_token as string;
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
  { sdkRequests }: CalendarProtocolObservation,
  tools: string[],
) {
  expect(
    sdkRequests
      .filter(({ rpc }) => rpc === "tools/call")
      .map(({ tool }) => tool),
  ).toEqual(tools);
}

async function observeSubscriptionState(
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

// Explicit domain expectations, independent of product responses and read models.
export async function expectSubscriptionState(
  fixture: SubscriptionFixture,
  worker: IsolatedWorker,
  sections: {
    sectionId: number;
    kind: "regular" | "auditor" | "teaching_assistant";
  }[],
) {
  expect(await observeSubscriptionState(fixture, worker)).toEqual({
    sections: [...sections].sort((a, b) => a.sectionId - b.sectionId),
    todos: [{ id: fixture.todo.id, title: fixture.todo.title, completed: false }],
    activities: [{ youngId: fixture.young.youngId }],
  });
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
