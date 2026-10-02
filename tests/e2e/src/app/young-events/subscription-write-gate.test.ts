import { expect, type Route } from "@playwright/test";
import { createDeferred } from "../../../../shared/deferred";
import { withBrowserWorkflow } from "../../../utils/browser-workflow";
import { createCalendarContractFixture } from "../../../utils/calendar-contract";
import { DEV_SEED } from "../../../utils/dev-seed";
import { withHomeworkEffects } from "../../../utils/homework-effects";
import type { IsolatedWorker } from "../../../utils/isolated-worker";
import { test as workerTest } from "../../../utils/owned-worker";

async function joinClickAndResponse(
  click: Promise<void>,
  response: Promise<unknown>,
) {
  const results = await Promise.allSettled([click, response]);
  const failures = results.flatMap((result) =>
    result.status === "rejected" ? [result.reason] : [],
  );
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1)
    throw new AggregateError(failures, "Young click and response failed");
}

async function prepareGate(worker: IsolatedWorker) {
  const state = await worker.database.owner.$transaction(async (db) => {
    await db.semester.create({
      data: {
        jwId: DEV_SEED.semesterJwId,
        code: "421",
        nameCn: DEV_SEED.semesterNameCn,
      },
    });
    const { cleanup: _cleanup, ...fixture } =
      await createCalendarContractFixture((work) =>
        work({ $transaction: async (operation) => operation(db) }),
      );
    const marker = crypto.randomUUID();
    const organizer = await db.youngOrganizer.create({
      data: { name: `Gate organizer ${marker}`, normalizedName: marker },
    });
    await db.userYoungOrganizerSubscription.create({
      data: { userId: fixture.users[0].id, organizerId: organizer.id },
    });
    return { fixture, organizer };
  });
  const session = await worker.createSession(state.fixture.users[0].id);
  return { ...state, session };
}

const test = workerTest.extend<{
  gate: Awaited<ReturnType<typeof prepareGate>>;
  gateRun: (work: Parameters<typeof withHomeworkEffects>[1]) => Promise<void>;
}>({
  gate: async ({ isolatedWorker, run }, use) => {
    await use(await run(() => prepareGate(isolatedWorker)));
  },
  gateRun: async ({ gate, page, isolatedWorker, run }, use) => {
    await withBrowserWorkflow(page, async (workflow) => {
      await use((work) =>
        workflow.run(() =>
          run(() =>
            withHomeworkEffects(
              {
                page,
                isolatedWorker,
                account: gate.fixture.users[0],
                runBody: workflow.body,
                // The 503 is local; targeted real GET/401 callbacks below are
                // tagged and joined. Other document GETs are not individually
                // correlated in this mutation scenario.
                observeReads: false,
                // Only the successful event unsubscribe rebuilds ICS.
                calendarMessages: [
                  { type: "user", userId: gate.fixture.users[0].id },
                ],
                calendarTokenCreated: false,
                auditActions: {},
              },
              work,
            ),
          ),
        ),
      );
    });
  },
});

test("young-event.subscription-write-gate", async ({
  page,
  isolatedWorker,
  gate,
  gateRun,
}) => {
  await gateRun(async ({ checkpoint, headers }) => {
    const { fixture, organizer, session } = gate;
    const db = isolatedWorker.database.owner;
    const calendarMessage = {
      type: "user" as const,
      userId: fixture.users[0].id,
    };
    await page.context().clearCookies();
    await page
      .context()
      .addCookies([
        { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
        session.cookie,
      ]);
    for (const kind of ["event", "organizer"] as const) {
      const id = kind === "event" ? fixture.young.youngId : organizer.id;
      const path =
        kind === "event"
          ? `/catalog/young-events/${id}`
          : `/catalog/young-events/organizers/${id}`;
      const endpoint = `/api/workspace/young-${kind}-subscriptions/${id}`;
      const routePattern = `**${endpoint}`;
      const action = page.getByRole("button", {
        name: kind === "event" ? "Unsubscribe" : "Unfollow",
        exact: true,
      });
      const { promise: entered, resolve: enterRead } = createDeferred();
      const { promise: held, resolve: releaseRead } = createDeferred();
      let writes = 0;
      let rejectWrite = true;
      let failRead = true;
      const pending = new Set<Promise<void>>();
      const failures: unknown[] = [];
      const releaseGates = () => {
        enterRead();
        releaseRead();
      };
      // The effect owner closes the page after a native test interruption.
      // Release even an entered-read waiter that never received its GET.
      page.on("close", releaseGates);
      const handler = (route: Route) => {
        const operation = (async () => {
          try {
            if (route.request().method() === "GET" && failRead) {
              enterRead();
              await held;
              await route.fulfill({
                status: 503,
                contentType: "application/json",
                body: JSON.stringify({ error: "Fixture read unavailable" }),
              });
              return;
            }
            if (route.request().method() === "GET") {
              const response = await route.fetch({
                headers: { ...route.request().headers(), ...headers },
                maxRedirects: 0,
              });
              expect(response.status()).toBe(200);
              await response.body();
              await route.fulfill({ response });
              return;
            }
            if (route.request().method() === "PUT") {
              writes++;
              if (rejectWrite) {
                const response = await route.fetch({
                  headers: {
                    ...route.request().headers(),
                    ...headers,
                    cookie: "",
                  },
                  maxRedirects: 0,
                });
                expect(response.status()).toBe(401);
                await response.body();
                await route.fulfill({ response });
                return;
              }
            }
            // Successful PUTs pass through the existing write/effect owner.
            await route.fallback();
          } catch (error) {
            failures.push(error);
            // A rejected handler must not leave the browser request parked.
            try {
              await route.abort();
            } catch (abortError) {
              failures.push(abortError);
            }
            throw error;
          }
        })();
        pending.add(operation);
        void operation.then(
          () => pending.delete(operation),
          () => pending.delete(operation),
        );
        return operation;
      };
      try {
        if (page.isClosed())
          throw new Error("Young subscription page is closed");
        await page.route(routePattern, handler);
        await page.goto(path);
        await entered;
        await expect(
          page.getByRole("button", { name: "Loading…", exact: true }),
        ).toBeDisabled();
        expect(writes).toBe(0);
        releaseRead();
        await expect(page.getByRole("alert")).toContainText(
          "Could not complete the request",
        );
        await expect(action).toHaveCount(0);
        expect(writes).toBe(0);
        failRead = false;
        await page.getByRole("button", { name: "Retry", exact: true }).click();
        await expect(action).toBeEnabled();
        expect(writes).toBe(0);
        const readState = async () => {
          const response = await page.request.get(endpoint, { headers });
          expect(response.status()).toBe(200);
          return response.json();
        };
        const before = await readState();
        expect(before.subscribed).toBe(true);
        const readStoredState = () =>
          db.$transaction([
            db.userYoungEventSubscription.findMany({
              orderBy: [{ userId: "asc" }, { youngId: "asc" }],
            }),
            db.userYoungOrganizerSubscription.findMany({
              orderBy: [{ userId: "asc" }, { organizerId: "asc" }],
            }),
            db.youngNotification.findMany({ orderBy: { id: "asc" } }),
          ]);
        const storedBefore = await readStoredState();
        await checkpoint(`${kind}-before-write`, {
          calendarMessages: kind === "event" ? [] : [calendarMessage],
        });
        const rejection = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === endpoint &&
            response.request().method() === "PUT" &&
            response.status() === 401,
        );
        await joinClickAndResponse(action.click(), rejection);
        await expect(action).toBeEnabled();
        expect(await readState()).toEqual(before);
        expect(writes).toBe(1);
        expect(await readStoredState()).toEqual(storedBefore);
        await checkpoint(`${kind}-rejected-write`, {
          calendarMessages: kind === "event" ? [] : [calendarMessage],
        });
        rejectWrite = false;
        const saved = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === endpoint &&
            response.request().method() === "PUT" &&
            response.status() === 200,
        );
        await joinClickAndResponse(action.click(), saved);
        await expect(
          page.getByRole("button", {
            name: kind === "event" ? "Subscribe to event" : "Follow organizer",
            exact: true,
          }),
        ).toBeEnabled();
        expect((await readState()).subscribed).toBe(false);
        expect(writes).toBe(2);
        expect(
          kind === "event"
            ? await db.userYoungEventSubscription.count({
                where: { userId: fixture.users[0].id, youngId: id },
              })
            : await db.userYoungOrganizerSubscription.count({
                where: { userId: fixture.users[0].id, organizerId: id },
              }),
        ).toBe(0);
        await checkpoint(`${kind}-unsubscribed`, {
          calendarMessages: [calendarMessage],
        });
      } catch (error) {
        failures.push(error);
      } finally {
        releaseGates();
        try {
          await page.unroute(routePattern, handler);
        } catch (error) {
          failures.push(error);
        }
        while (pending.size) await Promise.allSettled(pending);
        page.off("close", releaseGates);
      }
      if (failures.length === 1) throw failures[0];
      if (failures.length > 1)
        throw new AggregateError(failures, "Young subscription gate failed");
    }
  });
});
