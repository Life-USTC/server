import { expect, test } from "@playwright/test";
import { createCalendarContractFixture } from "../../../utils/calendar-contract";
import { PLAYWRIGHT_BASE_URL } from "../../../utils/e2e-db/core";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { createSignedSessionCookie } from "../../../utils/signed-session-cookie";

test("young-event.subscription-write-gate", async ({ page }) => {
  const fixture = await createCalendarContractFixture();
  const organizer = await withE2ePrisma(async (db) => {
    const marker = crypto.randomUUID();
    const row = await db.youngOrganizer.create({
      data: { name: `Gate organizer ${marker}`, normalizedName: marker },
    });
    await db.userYoungOrganizerSubscription.create({
      data: { userId: fixture.users[0].id, organizerId: row.id },
    });
    return row;
  });
  try {
    await page.context().clearCookies();
    await page
      .context()
      .addCookies([
        { name: "NEXT_LOCALE", value: "en-us", url: PLAYWRIGHT_BASE_URL },
        await createSignedSessionCookie(fixture.users[0].id),
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
      let enterRead: () => void = () => {};
      let releaseRead: () => void = () => {};
      const entered = new Promise<void>((resolve) => {
        enterRead = resolve;
      });
      const held = new Promise<void>((resolve) => {
        releaseRead = resolve;
      });
      let writes = 0;
      let rejectWrite = true;
      let failRead = true;
      await page.route(routePattern, async (route) => {
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
        if (route.request().method() === "PUT") {
          writes++;
          if (rejectWrite) {
            const response = await route.fetch({
              headers: { ...route.request().headers(), cookie: "" },
            });
            expect(response.status()).toBe(401);
            await route.fulfill({ response });
            return;
          }
        }
        await route.continue();
      });
      await page.goto(path);
      await entered;
      await expect(
        page.getByRole("button", {
          name: kind === "event" ? "Subscribe to event" : "Loading…",
          exact: true,
        }),
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
        const response = await page.request.get(endpoint);
        expect(response.status()).toBe(200);
        return response.json();
      };
      const before = await readState();
      expect(before.subscribed).toBe(true);
      const rejection = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === endpoint &&
          response.request().method() === "PUT" &&
          response.status() === 401,
      );
      await action.click();
      await rejection;
      await expect(action).toBeEnabled();
      expect(await readState()).toEqual(before);
      expect(writes).toBe(1);
      rejectWrite = false;
      const saved = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === endpoint &&
          response.request().method() === "PUT" &&
          response.status() === 200,
      );
      await action.click();
      await saved;
      await expect(
        page.getByRole("button", {
          name: kind === "event" ? "Subscribe to event" : "Follow organizer",
          exact: true,
        }),
      ).toBeEnabled();
      expect((await readState()).subscribed).toBe(false);
      expect(writes).toBe(2);
      await page.unroute(routePattern);
    }
  } finally {
    await fixture.cleanup();
    await withE2ePrisma((db) =>
      db.youngOrganizer.delete({ where: { id: organizer.id } }),
    );
  }
});
