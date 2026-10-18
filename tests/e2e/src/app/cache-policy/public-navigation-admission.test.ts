import { expect } from "@playwright/test";
import { PUBLIC_NAVIGATION_HEADER } from "@/lib/shell/public-navigation-contract";
// Relative navigation needs the origin of this case's own Worker; the plain
// Playwright test has no base URL on this branch.
import { test } from "../../../utils/isolated-worker";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

const publicData = {
  type: "data",
  nodes: [
    { type: "skip" },
    { type: "data", data: [{ title: 1 }, "Public page"] },
  ],
};

test("browser caches only attested successful public navigation responses", {
  tag: "@Site/Web",
}, async ({ page }) => {
  await gotoAndWaitForReady(page, "/privacy");
  const cases = [
    {
      name: "public",
      body: JSON.stringify(publicData),
      attested: true,
      requests: 1,
    },
    {
      name: "cookie",
      body: JSON.stringify(publicData),
      cookie: true,
      requests: 2,
    },
    {
      name: "private-root",
      body: JSON.stringify({
        type: "data",
        nodes: [
          { type: "data", data: [{ user: 1 }, { id: 2 }, "private-viewer"] },
        ],
      }),
      requests: 2,
    },
    {
      name: "redirect",
      body: JSON.stringify({ type: "redirect", location: "/account/welcome" }),
      attested: true,
      requests: 2,
    },
    {
      name: "error",
      body: JSON.stringify({
        type: "data",
        nodes: [
          { type: "error", status: 403, error: { message: "Forbidden" } },
        ],
      }),
      attested: true,
      requests: 2,
    },
    {
      name: "deferred-error",
      body: '{"type":"data","nodes":[{"type":"data","data":[{"later":1},["Promise",1]]}]}\n{"type":"chunk","id":1,"error":[{"message":1},"failed"]}\n',
      attested: true,
      contentType: "text/sveltekit-data",
      requests: 2,
    },
  ];
  for (const item of cases) {
    let requests = 0;
    const path = `/news/__data.json?x-sveltekit-invalidated=01&admission=${item.name}`;
    await page.route(`**${path}`, async (route) => {
      requests++;
      await route.fulfill({
        status: 200,
        body: item.body,
        headers: {
          "content-type": item.contentType ?? "application/json",
          "cache-control": "private, no-store",
          ...(item.attested ? { [PUBLIC_NAVIGATION_HEADER]: "1" } : {}),
          ...(item.cookie
            ? { "set-cookie": "admission=renewed; Path=/; HttpOnly" }
            : {}),
        },
      });
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await page.evaluate(async (path) => {
        const response = await fetch(new URL(path, location.origin));
        return {
          body: await response.text(),
          hasSetCookie: response.headers.has("set-cookie"),
        };
      }, path);
      expect(result.body, item.name).toBe(item.body);
      // This assertion uses real Chromium Headers, which hide Set-Cookie.
      expect(result.hasSetCookie, item.name).toBe(false);
    }
    expect(requests, item.name).toBe(item.requests);
    if (item.cookie) {
      expect(
        (await page.context().cookies()).find(
          (cookie) => cookie.name === "admission",
        )?.value,
      ).toBe("renewed");
    }
    await page.unroute(`**${path}`);
  }
});

for (const trigger of ["sign-out", "pagehide"] as const) {
  test(`browser clears public navigation entries on ${trigger}`, {
    tag: "@Site/Web",
  }, async ({ page }) => {
    await gotoAndWaitForReady(page, "/privacy");
    const paths = ["/news", "/catalog/courses"].map(
      (path) =>
        `${path}/__data.json?x-sveltekit-invalidated=01&clear=${trigger}`,
    );
    const requests = new Map<string, number>();
    for (const path of paths) {
      await page.route(`**${path}`, async (route) => {
        requests.set(path, (requests.get(path) ?? 0) + 1);
        await route.fulfill({
          json: publicData,
          headers: {
            "cache-control": "private, no-store",
            [PUBLIC_NAVIGATION_HEADER]: "1",
          },
        });
      });
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      for (const path of paths) {
        expect(
          await page.evaluate(async (path) => (await fetch(path)).json(), path),
        ).toEqual(publicData);
        expect(requests.get(path)).toBe(1);
      }
    }

    if (trigger === "sign-out") {
      expect(
        await page.evaluate(async () => {
          const response = await fetch("/api/auth/sign-out", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{}",
          });
          return response.status;
        }),
      ).toBe(200);
    } else {
      await page.evaluate(() => {
        window.dispatchEvent(
          new PageTransitionEvent("pagehide", { persisted: true }),
        );
      });
    }

    for (const path of paths) {
      expect(
        await page.evaluate(async (path) => (await fetch(path)).json(), path),
      ).toEqual(publicData);
      expect(requests.get(path)).toBe(2);
    }
  });
}
