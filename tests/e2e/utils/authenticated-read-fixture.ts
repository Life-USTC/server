import { expect, type Page } from "@playwright/test";
import type {
  User,
  YoungEvent,
} from "../../../src/generated/prisma-node/client";
import { readCalendarState } from "./calendar-read-observation";
import { type CommunityFlow, withCommunityFlow } from "./community-flow";
import type { IsolatedWorker } from "./isolated-worker";
import { test as preferenceTest } from "./personal-preferences-fixture";
import { arrangeSignInCredential } from "./signin-fixture";

export const test = preferenceTest.extend<{
  privateLoginUser: User;
  loginFlow: CommunityFlow;
}>({
  privateLoginUser: async ({ isolatedWorker, run }, use) => {
    const abort = new AbortController();
    try {
      await use(
        await run(() =>
          arrangeSignInCredential(
            isolatedWorker.database.owner,
            false,
            abort.signal,
          ),
        ),
      );
    } finally {
      abort.abort(new Error("Private login fixture closed"));
    }
  },
  loginFlow: async (
    { page, browser, request: observer, isolatedWorker, privateLoginUser, run },
    use,
    testInfo,
  ) => {
    await run(() =>
      withCommunityFlow(
        {
          page,
          browser,
          observer,
          isolatedWorker,
          account: privateLoginUser,
          testInfo,
        },
        use,
      ),
    );
  },
});
type Database = IsolatedWorker["database"]["owner"];

/** Called inside the scenario's existing complete callback owner. */
export async function preparePrivateViewer(
  page: Page,
  worker: IsolatedWorker,
  isAdmin: boolean,
) {
  const actor = await worker.createActor({ isAdmin });
  const db = worker.database.owner;
  const user = await db.user.update({
    where: { id: actor.id },
    data: {
      name: isAdmin ? "Private admin" : "Private reader",
      username: isAdmin ? "private-admin" : "private-reader",
    },
  });
  const now = new Date();
  await db.session.updateMany({
    where: { userId: actor.id },
    data: {
      expires: new Date(now.getTime() + 30 * 86_400_000),
      updatedAt: now,
    },
  });
  const sessions = await db.session.findMany();
  expect(sessions).toHaveLength(1);
  expect(sessions[0].userId).toBe(user.id);
  await page.context().addCookies([actor.cookie]);
  return { user, sessions };
}

/** Independent empty workspace graph, with only the explicitly prepared records. */
export async function expectReadOnlyWorkspace(
  db: Database,
  users: User[],
  youngEvents: YoungEvent[],
) {
  expect(await readCalendarState(db)).toEqual({
    users,
    subscriptions: [],
    todos: [],
    youngSubscriptions: [],
    youngEvents,
    homework: [],
    completions: [],
    semesters: [],
    courses: [],
    sections: [],
    groups: [],
    schedules: [],
    exams: [],
  });
  for (const rows of await Promise.all([
    db.youngOrganizer.findMany(),
    db.userYoungOrganizerSubscription.findMany(),
    db.youngNotification.findMany(),
    db.comment.findMany(),
    db.upload.findMany(),
    db.uploadPending.findMany(),
    db.workspaceLinkPin.findMany(),
    db.busUserPreference.findMany(),
    db.catalogLinkClick.findMany(),
    db.oAuthClient.findMany(),
    db.oAuthConsent.findMany(),
    db.oAuthAccessToken.findMany(),
    db.oAuthRefreshToken.findMany(),
    db.oAuthGrantUsageDaily.findMany(),
  ]))
    expect(rows).toEqual([]);
}

/** Run only after the browser workflow has drained. */
export async function expectPrivateViewerState(
  db: Database,
  viewer: Awaited<ReturnType<typeof preparePrivateViewer>>,
  youngEvents: YoungEvent[],
) {
  await expectReadOnlyWorkspace(db, [viewer.user], youngEvents);
  expect(await db.session.findMany()).toEqual(viewer.sessions);
  expect(await db.account.findMany()).toEqual([]);
  expect(await db.passkey.findMany()).toEqual([]);
  expect(await db.verifiedEmail.findMany()).toEqual([]);
  expect(await db.auditLog.findMany()).toEqual([]);
}
