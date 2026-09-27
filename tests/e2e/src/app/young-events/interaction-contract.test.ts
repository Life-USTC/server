import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { expect, type Page, test } from "@playwright/test";
import { createCalendarContractFixture } from "../../../utils/calendar-contract";
import { PLAYWRIGHT_BASE_URL } from "../../../utils/e2e-db/core";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";

declare global {
  interface Window {
    youngContractFetches: { path: string; cache: string | undefined }[];
  }
}
async function identify(page: Page, owner?: string) {
  await page.context().clearCookies();
  await page
    .context()
    .addCookies([
      { name: "NEXT_LOCALE", value: "en-us", url: PLAYWRIGHT_BASE_URL },
      ...(owner ? [await createSignedSessionCookie(owner)] : []),
    ]);
}
async function observePrivateFetches(page: Page) {
  await page.addInitScript(() => {
    window.youngContractFetches = [];
    const realFetch = window.fetch;
    window.fetch = (input, init) => {
      const url = new URL(
        input instanceof Request ? input.url : String(input),
        location.href,
      );
      if (
        url.pathname.startsWith("/api/workspace/young-event-subscriptions/") ||
        url.pathname === "/api/workspace/calendar/events"
      )
        window.youngContractFetches.push({
          path: url.pathname,
          cache: init?.cache,
        });
      return realFetch(input, init);
    };
  });
}

test("young-event.private-client-overlays", async ({ page }) => {
  const fixture = await createCalendarContractFixture();
  await observePrivateFetches(page);
  try {
    for (const surface of ["detail", "calendar"]) {
      const target =
        surface === "detail"
          ? `/catalog/young-events/${fixture.young.youngId}`
          : "/catalog/young-events/calendar?view=day&date=2026-04-30";
      const endpoint =
        surface === "detail"
          ? `**/api/workspace/young-event-subscriptions/${fixture.young.youngId}`
          : "**/api/workspace/calendar/events?*";
      const ready = () =>
        surface === "detail"
          ? page.getByRole("button", { name: "Unsubscribe", exact: true })
          : page.getByTestId("young-calendar-conflict-status");
      const signIn = () =>
        surface === "detail"
          ? page.getByRole("button", {
              name: "Sign in to subscribe",
              exact: true,
            })
          : page.getByTestId("young-calendar-conflict-status");
      await identify(page);
      await page.goto(target);
      await expect(signIn()).toContainText(/Sign in/);
      expect(await page.evaluate(() => window.youngContractFetches)).toEqual(
        [],
      );
      await identify(page, fixture.users[0].id);
      await page.goto(target);
      if (surface === "detail") await expect(ready()).toBeEnabled();
      else await expect(ready()).toContainText("Conflicts use");
      const signedReads = await page.evaluate(
        () => window.youngContractFetches,
      );
      expect(signedReads.length).toBeGreaterThan(0);
      expect(signedReads.every((read) => read.cache === "no-store")).toBe(true);
      let rejectedReads = 0;
      await page.route(endpoint, async (route) => {
        const response = await route.fetch({
          headers: { ...route.request().headers(), cookie: "" },
        });
        expect(response.status()).toBe(401);
        rejectedReads++;
        await route.fulfill({ response });
      });
      await page.goto(target);
      await expect(signIn()).toContainText(/Sign in/);
      expect(rejectedReads).toBeGreaterThan(0);
      expect(
        (await page.evaluate(() => window.youngContractFetches)).every(
          (read) => read.cache === "no-store",
        ),
      ).toBe(true);
      await page.unroute(endpoint);
    }
  } finally {
    await fixture.cleanup();
  }
});

test("young-event.overlay-shared-viewer-state", async ({ page }) => {
  const fixture = await createCalendarContractFixture();
  try {
    await identify(page, fixture.users[0].id);
    let bootstrap = 0;
    let viewerId: string | undefined;
    page.on("response", async (response) => {
      if (new URL(response.url()).pathname === "/_internal/shell-bootstrap") {
        const body = await response.json();
        viewerId = body.viewer?.id;
      }
    });
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/_internal/shell-bootstrap")
        bootstrap++;
    });
    for (const target of [
      `/catalog/young-events/${fixture.young.youngId}`,
      "/catalog/young-events/calendar?view=day&date=2026-04-30",
    ]) {
      bootstrap = 0;
      viewerId = undefined;
      await page.goto(target);
      if (target.startsWith("/catalog/young-events/calendar?"))
        await expect(
          page.getByTestId("young-calendar-conflict-status"),
        ).toContainText("Conflicts use");
      else
        await expect(
          page.getByRole("button", { name: "Unsubscribe", exact: true }),
        ).toBeEnabled();
      expect(bootstrap).toBe(1);
      await expect.poll(() => viewerId).toBe(fixture.users[0].id);
    }
  } finally {
    await fixture.cleanup();
  }
});

test("young-event.web-detail-priority", async ({ page }) => {
  const fixture = await createCalendarContractFixture();
  await withE2ePrisma((db) =>
    db.youngEvent.update({
      where: { youngId: fixture.young.youngId },
      data: {
        hours: 2.5,
        requiresSignup: true,
        applyEndAt: new Date("2026-04-29T20:00:00+08:00"),
        imageUrl: "group1/contract/poster.jpg",
        sumPersons: 17,
        sumHours: 42,
        createdAtUpstream: new Date("2026-04-01T12:00:00+08:00"),
      },
    }),
  );
  try {
    await identify(page);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/catalog/young-events/${fixture.young.youngId}`);
      const summary = page.getByTestId("young-event-overview");
      await expect(summary).toContainText("2026-04-30 16:00");
      await expect(summary).toContainText("Calendar activity room");
      await expect(summary).toContainText("2.5");
      await expect(summary).toContainText("2026-04-29 20:00");
      const official = page.locator(
        '#main-content a[href="https://young.ustc.edu.cn"]',
      );
      await expect(official).toBeVisible();
      await expect(official).toHaveAttribute("target", "_blank");
      const poster = page.getByRole("button", {
        name: "Activity poster",
        exact: true,
      });
      const details = page.getByRole("button", {
        name: "More activity details",
        exact: true,
      });
      await expect(poster).toHaveAttribute("aria-expanded", "false");
      await expect(details).toHaveAttribute("aria-expanded", "false");
      await expect(
        page.getByRole("heading", {
          name: "Attendance and hours",
          exact: true,
        }),
      ).toBeHidden();
      await expect(
        page.getByRole("heading", { name: "Record information", exact: true }),
      ).toBeHidden();
      expect((await summary.boundingBox())?.y).toBeLessThan(
        (await poster.boundingBox())?.y ?? 0,
      );
      await poster.click();
      await expect(
        page.getByRole("img", { name: fixture.young.name, exact: true }),
      ).toHaveAttribute(
        "src",
        "/api/catalog/young-events/images/group1/contract/poster.jpg",
      );
      await details.click();
      await expect(
        page.getByRole("heading", {
          name: "Attendance and hours",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByText("Total attendances", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Record information", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("2026-04-01 12:00", { exact: true }),
      ).toBeVisible();
    }
  } finally {
    await fixture.cleanup();
  }
});

test("young-event.web-mobile-calendar", async ({ page }) => {
  await identify(page);
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto("/catalog/young-events/calendar?view=month&date=2035-09-25");
  const calendar = page.getByTestId("young-calendar");
  await expect(
    calendar.getByRole("link", { name: "Month", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  const headings = page
    .getByTestId("young-calendar-agenda")
    .getByRole("heading", { level: 3 });
  await expect(headings.first()).toHaveAttribute(
    "id",
    "young-agenda-2035-09-25",
  );
  await expect(headings.last()).toHaveAttribute(
    "id",
    "young-agenda-2035-09-30",
  );
  await calendar
    .getByRole("button", { name: "Show earlier dates", exact: true })
    .click();
  await expect(page.locator("#young-agenda-2035-09-01")).toBeVisible();
  await expect(page.locator("#young-agenda-2035-08-31")).toHaveCount(0);
  await expect(page.locator("#young-agenda-2035-10-01")).toHaveCount(0);
  for (const [label, value, heading] of [
    ["Day", "day", "Tuesday, September 25, 2035"],
    ["Week", "week", /Sep 24\s*–\s*30, 2035/],
    ["Month", "month", "September 2035"],
  ] as const) {
    await calendar.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`view=${value}`));
    await expect(
      calendar.getByRole("link", { name: label, exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(calendar.getByRole("heading", { level: 2 })).toHaveText(
      heading,
    );
  }
});

test("young-event.read-only", async ({ page, request }) => {
  const fixture = await createCalendarContractFixture();
  const client = new Client({ name: "young-read-only", version: "1" });
  try {
    await identify(page, fixture.users[0].id);
    for (const path of [
      "/api/catalog/young-events",
      `/api/catalog/young-events/${fixture.young.youngId}`,
    ]) {
      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        const response = await page.request.fetch(path, {
          method,
          headers: { Origin: PLAYWRIGHT_BASE_URL },
          data: { name: "forbidden replacement" },
        });
        expect(response.status(), `${method} ${path}`).toBe(405);
      }
    }
    const graph = await request.post("/api/graphql", {
      headers: { Origin: PLAYWRIGHT_BASE_URL },
      data: { query: "{__schema{mutationType{fields{name}}}}" },
    });
    expect(graph.status()).toBe(200);
    const schema = await graph.json();
    expect(schema.errors).toBeUndefined();
    expect(
      schema.data.__schema.mutationType.fields
        .map((field: { name: string }) => field.name)
        .filter((name: string) => name.toLowerCase().includes("young")),
    ).toEqual([
      "youngEventSubscriptionSet",
      "youngOrganizerSubscriptionSet",
      "youngNotificationRead",
    ]);
    await client.connect(
      new StreamableHTTPClientTransport(
        new URL("/api/mcp", PLAYWRIGHT_BASE_URL),
      ),
    );
    const tools = await client.listTools();
    expect(
      tools.tools
        .filter((tool) => tool.name.startsWith("catalog_young_"))
        .map((tool) => tool.name)
        .sort(),
    ).toEqual([
      "catalog_young_event_get",
      "catalog_young_event_list",
      "catalog_young_organizer_get",
      "catalog_young_organizer_list",
    ]);
    await page.goto(`/catalog/young-events/${fixture.young.youngId}`);
    await expect(
      page.getByRole("heading", { level: 1, name: fixture.young.name }),
    ).toBeVisible();
    await expect(
      page.locator("#main-content").getByRole("button", {
        name: /^(Edit event|Delete event|Create event|Save event)$/,
      }),
    ).toHaveCount(0);
    expect(
      await withE2ePrisma((db) =>
        db.youngEvent.findUnique({
          where: { youngId: fixture.young.youngId },
          select: { name: true },
        }),
      ),
    ).toEqual({ name: fixture.young.name });
  } finally {
    await client.close();
    await fixture.cleanup();
  }
});
