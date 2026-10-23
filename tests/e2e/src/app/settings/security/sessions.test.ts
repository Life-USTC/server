import { expect } from "@playwright/test";
import { confirmRevocation, openSessions, test } from "./_session-fixture";

test.describe.configure({ mode: "parallel" });

test("mobile session details remain fully visible", {
  tag: "@Account/Web",
}, async ({ page, sessions: _sessions, sessionRun }) => {
  await sessionRun(async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    const panel = await openSessions(page);
    await expect(panel.locator("[data-session-id]")).toHaveCount(3);
    for (const description of await panel
      .locator("[data-slot=item-description]")
      .all()) {
      await expect(description).toContainText(/到期于|Expires/);
      expect(
        await description.evaluate(
          (element) => element.scrollHeight <= element.clientHeight,
        ),
      ).toBe(true);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
});

test("session loading disables mutations", {
  tag: "@Account/Web",
}, async ({ page, sessions: _sessions, sessionRun }) => {
  await sessionRun(async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/auth/list-sessions", async (route) => {
      await pending;
      await route.continue();
    });
    try {
      await page.goto("/account/settings/security");
      const panel = page.locator("[data-session-settings]");
      await expect(panel.getByRole("status")).toBeVisible();
      await expect(
        panel.getByRole("button", {
          name: /撤销其他会话|Revoke other sessions/,
        }),
      ).toBeDisabled();
      await expect(
        panel.getByRole("button", { name: /撤销全部会话|Revoke all sessions/ }),
      ).toBeDisabled();
    } finally {
      release();
    }
    await expect(page.locator("[data-session-id]")).toHaveCount(3);
  });
});

test("stale session list offers reauthentication", {
  tag: "@Account/Web",
}, async ({ page, sessions, isolatedWorker, sessionRun }) => {
  await sessionRun(async () => {
    await isolatedWorker.database.owner.session.update({
      where: { id: sessions.current.id },
      data: { createdAt: new Date(Date.now() - 30 * 60 * 1000) },
    });
    await page.goto("/account/settings/security");
    const panel = page.locator("[data-session-settings]");
    await expect(
      panel.getByText(
        /请重新登录后查看有效会话|Sign in again to review your active sessions/,
      ),
    ).toBeVisible();
    await expect(panel.locator("[data-session-id]")).toHaveCount(0);
    await expect(
      panel.getByRole("button", { name: /撤销其他会话|Revoke other sessions/ }),
    ).toBeDisabled();
    const signIn = panel.getByRole("link", { name: /重新登录|Sign in again/ });
    await expect(signIn).toHaveAttribute(
      "href",
      "/account/sign-in?reauth=1&callbackUrl=%2Faccount%2Fsettings%2Fsecurity",
    );
    await signIn.click();
    await expect(page).toHaveURL(
      /\/account\/sign-in\?reauth=1&callbackUrl=%2Faccount%2Fsettings%2Fsecurity/,
    );
  });
});

test("revocation hides stale sessions when the refresh needs reauthentication", {
  tag: "@Account/Web",
}, async ({ page, sessions, isolatedWorker, sessionRun }) => {
  await sessionRun(async () => {
    const panel = await openSessions(page);
    await expect(panel.locator("[data-session-id]")).toHaveCount(3);
    await isolatedWorker.database.owner.session.update({
      where: { id: sessions.current.id },
      data: { createdAt: new Date(Date.now() - 30 * 60 * 1000) },
    });
    await panel
      .getByRole("button", { name: /撤销其他会话|Revoke other sessions/ })
      .click();
    const response = page.waitForResponse((response) =>
      response.url().endsWith("/api/auth/revoke-other-sessions"),
    );
    await confirmRevocation(page);
    expect((await response).status()).toBe(200);
    await expect(
      panel.getByRole("link", { name: /重新登录|Sign in again/ }),
    ).toBeVisible();
    await expect(panel.locator("[data-session-id]")).toHaveCount(0);
    await expect(
      panel.getByRole("button", { name: /撤销全部会话|Revoke all sessions/ }),
    ).toBeDisabled();
    const remaining = await isolatedWorker.database.owner.session.findMany({
      select: { id: true },
    });
    expect(remaining.map(({ id }) => id).sort()).toEqual(
      [sessions.current.id, sessions.foreign.id].sort(),
    );
  });
});

test("session list failure retries without enabling mutations", {
  tag: "@Account/Web",
}, async ({ page, sessions, sessionRun }) => {
  await sessionRun(async () => {
    await page.route(
      "**/api/auth/list-sessions",
      (route) =>
        route.fulfill({ status: 503, json: { message: "Unavailable" } }),
      { times: 1 },
    );
    await page.goto("/account/settings/security");
    const panel = page.locator("[data-session-settings]");
    await expect(
      panel.getByText(/无法加载会话|Unable to load sessions/),
    ).toBeVisible();
    await expect(
      panel.getByRole("button", { name: /撤销其他会话|Revoke other sessions/ }),
    ).toBeDisabled();
    await expect(
      panel.getByRole("button", { name: /撤销全部会话|Revoke all sessions/ }),
    ).toBeDisabled();
    await panel.getByRole("button", { name: /重试|Retry/ }).click();
    await expect(panel.locator("[data-session-id]")).toHaveCount(3);
    await expect(
      panel.locator(`[data-session-id="${sessions.current.id}"]`),
    ).toContainText(/当前会话|Current session/);
    await expect(
      panel.locator(`[data-session-id="${sessions.other.id}"]`),
    ).toContainText("Chrome · Windows");
    await expect(
      panel.locator(`[data-session-id="${sessions.current.id}"]`),
    ).toContainText("Safari · macOS");
    await expect(
      panel.locator(`[data-session-id="${sessions.other.id}"]`),
    ).toContainText(/登录于|Signed in/);
    await expect(
      panel.locator(`[data-session-id="${sessions.other.id}"]`),
    ).toContainText(/到期于|Expires/);
    await expect(
      panel.locator(`[data-session-id="${sessions.foreign.id}"]`),
    ).toHaveCount(0);
    const rendered = await panel.innerHTML();
    expect(rendered).not.toContain(sessions.other.sessionToken);
    expect(rendered).not.toContain("Chrome/130.0");
  });
});

test("revoke one other session retries and refreshes the list", {
  tag: "@Account/Web",
}, async ({ page, sessions, sessionRun, isolatedWorker, account }) => {
  await sessionRun(async () => {
    const panel = await openSessions(page);
    const row = panel.locator(`[data-session-id="${sessions.other.id}"]`);
    await row
      .getByRole("button", { name: /撤销会话|Revoke session/, exact: true })
      .click();
    await expect(page.getByRole("alertdialog")).toContainText(
      /当前会话保持登录|current session will stay signed in/,
    );
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: /取消|Cancel/ })
      .click();
    expect(
      await isolatedWorker.database.owner.session.count({
        where: { userId: account.id },
      }),
    ).toBe(3);
    await page.route(
      "**/api/auth/revoke-session",
      (route) =>
        route.fulfill({ status: 503, json: { message: "Unavailable" } }),
      { times: 1 },
    );
    await row
      .getByRole("button", { name: /撤销会话|Revoke session/, exact: true })
      .click();
    await confirmRevocation(page);
    await expect(
      panel.getByText(
        /无法撤销所选会话|Unable to revoke the selected sessions/,
      ),
    ).toBeVisible();
    await expect(row).toBeVisible();
    expect(
      await isolatedWorker.database.owner.session.count({
        where: { id: sessions.other.id },
      }),
    ).toBe(1);
    const response = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/auth/revoke-session") &&
        response.request().method() === "POST",
    );
    await panel.getByRole("button", { name: /重试|Retry/ }).click();
    expect((await response).status()).toBe(200);
    await expect(row).toHaveCount(0);
    const remaining = await isolatedWorker.database.owner.session.findMany({
      select: { id: true },
    });
    expect(remaining.map(({ id }) => id).sort()).toEqual(
      [sessions.current.id, sessions.another.id, sessions.foreign.id].sort(),
    );
    await expect(page).toHaveURL(/\/account\/settings\/security$/);
  });
});

test("revoke other sessions keeps the current session", {
  tag: "@Account/Web",
}, async ({ page, sessions, sessionRun, isolatedWorker }) => {
  await sessionRun(async () => {
    const panel = await openSessions(page);
    await panel
      .getByRole("button", { name: /撤销其他会话|Revoke other sessions/ })
      .click();
    const response = page.waitForResponse((response) =>
      response.url().endsWith("/api/auth/revoke-other-sessions"),
    );
    await confirmRevocation(page);
    expect((await response).status()).toBe(200);
    await expect(panel.locator("[data-session-id]")).toHaveCount(1);
    await expect(
      panel.locator(`[data-session-id="${sessions.current.id}"]`),
    ).toBeVisible();
    await expect(
      panel.getByRole("button", { name: /撤销其他会话|Revoke other sessions/ }),
    ).toBeDisabled();
    const remaining = await isolatedWorker.database.owner.session.findMany({
      select: { id: true },
    });
    expect(remaining.map(({ id }) => id).sort()).toEqual(
      [sessions.current.id, sessions.foreign.id].sort(),
    );
  });
});

for (const all of [false, true]) {
  test(all
    ? "revoke all sessions returns to sign-in"
    : "revoke current session returns to sign-in", {
    tag: "@Account/Web",
  }, async ({ page, sessions, sessionRun, isolatedWorker }) => {
    await sessionRun(async () => {
      const panel = await openSessions(page);
      if (all) {
        await panel
          .getByRole("button", { name: /撤销全部会话|Revoke all sessions/ })
          .click();
      } else {
        await panel
          .locator(`[data-session-id="${sessions.current.id}"]`)
          .getByRole("button", { name: /撤销会话|Revoke session/, exact: true })
          .click();
      }
      await expect(page.getByRole("alertdialog")).toContainText(
        /返回登录页|return to sign-in/,
      );
      const endpoint = all
        ? "/api/auth/revoke-sessions"
        : "/api/auth/revoke-session";
      const response = page.waitForResponse((response) =>
        response.url().endsWith(endpoint),
      );
      await confirmRevocation(page);
      expect((await response).status()).toBe(200);
      await expect(page).toHaveURL(
        /\/account\/sign-in\?callbackUrl=%2Faccount%2Fsettings%2Fsecurity/,
      );
      const remaining = await isolatedWorker.database.owner.session.findMany({
        select: { id: true },
      });
      expect(remaining.map(({ id }) => id).sort()).toEqual(
        (all
          ? [sessions.foreign.id]
          : [sessions.other.id, sessions.another.id, sessions.foreign.id]
        ).sort(),
      );
      await expect(page.locator("[data-session-settings]")).toHaveCount(0);
    });
  });
}
