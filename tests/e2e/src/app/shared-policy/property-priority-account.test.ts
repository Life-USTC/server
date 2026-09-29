import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
} from "@/lib/oauth/constants";
import en from "../../../../../messages/en-us.json" with { type: "json" };
import zh from "../../../../../messages/zh-cn.json" with { type: "json" };
import { sha256Base64Url } from "../../../../shared/crypto";
import { DEV_SEED } from "../../../utils/dev-seed";
import {
  createOAuthAuthorizationFixture,
  createOAuthClientFixture,
  ensureLinkedAccountFixture,
  PLAYWRIGHT_BASE_URL,
} from "../../../utils/e2e-db";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { assertPriorityView } from "../../../utils/property-priority";
import { createSignedSessionCookie } from "../../../utils/signed-session-cookie";

const oauthScopeLabel = (
  locale: "en-us" | "zh-cn",
  scope: "profile" | "workspace.calendar:read",
) => (locale === "en-us" ? en : zh).oauth[`scope_${scope}`];
const text = (locator: Locator, expected: string | RegExp) => ({
  locator,
  expected,
});
const input = (locator: Locator, expected: string) => ({
  locator,
  expected,
  input: true,
});
const image = (locator: Locator, expected: string) => ({
  locator,
  expected,
  attribute: "src" as const,
});
const dateLabel = (locale: string, value: Date) =>
  new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai",
  }).format(value);
const fact = (scope: Locator, label: string) =>
  scope
    .locator("dl > div")
    .filter({ has: scope.page().getByText(label, { exact: true }) })
    .locator("dd");

async function makeFixture() {
  const marker = crypto.randomUUID();
  const now = new Date(Math.floor(Date.now() / 60000) * 60000);
  const user = await withE2ePrisma((db) =>
    db.user.create({
      data: {
        name: "Priority account",
        username: `pf${marker.replaceAll("-", "").slice(0, 12)}`,
        email: `${marker}@example.test`,
        isAdmin: true,
        image: "/images/priority-current.svg",
        profilePictures: [
          "/images/priority-current.svg",
          "/images/priority-alternate.svg",
        ],
      },
    }),
  );
  const authorization = await createOAuthAuthorizationFixture({
    name: "Priority Calendar",
    scopes: ["profile", "workspace.calendar:read"],
    userId: user.id,
  });
  const client = await createOAuthClientFixture({
    name: "Priority Device",
    clientId: `https://priority-app.example.test/${marker}/client.json`,
    scopes: ["openid", "profile"],
    tokenEndpointAuthMethod: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
    grantTypes: ["authorization_code", OAUTH_DEVICE_CODE_GRANT_TYPE],
    redirectUris: ["https://priority-callback.example.test/return"],
  });
  const account = await ensureLinkedAccountFixture({
    userId: user.id,
    provider: "github",
    providerAccountId: `priority-${marker}`,
  });
  const records = await withE2ePrisma(async (db) => {
    await db.oAuthClient.update({
      where: { clientId: authorization.clientId },
      data: { disabled: true },
    });
    await db.oAuthClient.update({
      where: { clientId: client.clientId },
      data: { uri: "https://priority-app.example.test" },
    });
    const consent = await db.oAuthConsent.update({
      where: { id: authorization.consentId },
      data: { updatedAt: now },
    });
    await db.oAuthGrantUsageDaily.create({
      data: {
        userId: user.id,
        clientId: authorization.clientId,
        grantId: consent.grantId,
        grantKey: `grant:${consent.grantId}`,
        day: new Date(
          `${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(now)}T00:00:00Z`,
        ),
        feature: "workspace.calendar",
        channel: "mcp",
        readCount: 7,
        writeCount: 3,
        errorCount: 2,
        lastUsedAt: now,
      },
    });
    const event = await db.auditLog.create({
      data: {
        action: "account_profile_update",
        outcome: "success",
        channel: "web",
        userId: user.id,
        subjectUserId: user.id,
        oauthClientId: authorization.clientId,
        createdAt: now,
        ipAddress: "203.0.113.42",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36",
      },
    });
    const passkey = await db.passkey.create({
      data: {
        userId: user.id,
        name: "Priority laptop",
        publicKey: "priority-fixture-public-key",
        credentialID: marker,
        counter: 0,
        deviceType: "singleDevice",
        backedUp: false,
        createdAt: now,
      },
    });
    return { event, passkey };
  });
  return {
    user,
    authorization,
    client,
    account,
    now,
    ...records,
    async cleanup() {
      await withE2ePrisma(async (db) => {
        await db.auditLog.deleteMany({
          where: { OR: [{ userId: user.id }, { subjectUserId: user.id }] },
        });
        await db.oAuthClient.deleteMany({
          where: {
            clientId: { in: [authorization.clientId, client.clientId] },
          },
        });
        await db.user.delete({ where: { id: user.id } });
      });
    },
  };
}
type Fixture = Awaited<ReturnType<typeof makeFixture>>;

async function checkProfile(page: Page, fixture: Fixture, welcome = false) {
  const scope = page.locator("#main-content");
  const name = scope.locator("#name");
  const username = scope.locator("#username");
  if (welcome) {
    await name.fill(fixture.user.name ?? "");
    await username.fill(fixture.user.username ?? "");
  }
  await assertPriorityView({
    scope,
    identity: name,
    primary: {
      "user.name": input(name, fixture.user.name ?? ""),
      "user.username": input(username, fixture.user.username ?? ""),
    },
    secondary: {
      "user.image": image(
        scope
          .locator('img[src="/images/priority-current.svg"]')
          .filter({ visible: true })
          .first(),
        fixture.user.image ?? "",
      ),
      "user.profilePictures": image(
        scope
          .locator('img[src="/images/priority-alternate.svg"]')
          .filter({ visible: true }),
        fixture.user.profilePictures[1],
      ),
    },
    tertiary: {},
  });
}

async function checkAuthorizations(
  page: Page,
  fixture: Fixture,
  locale: "en-us" | "zh-cn",
) {
  const copy = (locale === "en-us" ? en : zh).settings;
  const scope = page
    .getByRole("listitem")
    .filter({ hasText: fixture.authorization.name });
  const identity = scope.locator('[data-slot="item-title"]');
  const primary = {
    "client.name": text(identity, fixture.authorization.name),
    "consent.scopes": text(
      scope.getByText(oauthScopeLabel(locale, "workspace.calendar:read"), {
        exact: true,
      }),
      oauthScopeLabel(locale, "workspace.calendar:read"),
    ),
  };
  const secondary = {
    "client.uri": text(
      scope.getByText(fixture.authorization.clientUri, { exact: true }),
      fixture.authorization.clientUri,
    ),
    "client.disabled": text(
      scope.getByText(copy.authorizations.disabled, { exact: true }),
      copy.authorizations.disabled,
    ),
    "consent.updatedAt": text(
      scope.getByText(`${copy.authorizations.updatedAt}:`, { exact: false }),
      dateLabel(locale, fixture.now),
    ),
    "activity.lastUsedAt": text(
      fact(scope, copy.authorizations.lastUsedAt),
      dateLabel(locale, fixture.now),
    ),
    "activity.channel": text(
      fact(scope, copy.authorizations.lastChannel),
      copy.security.channels.mcp,
    ),
    "activity.feature": text(
      fact(scope, copy.authorizations.lastFeature),
      (locale === "en-us" ? en : zh).oauth["scopeFeature_workspace.calendar"],
    ),
    "activity.readCount": text(fact(scope, copy.authorizations.reads), "7"),
    "activity.writeCount": text(fact(scope, copy.authorizations.writes), "3"),
    "activity.errorCount": text(fact(scope, copy.authorizations.errors), "2"),
  };
  await assertPriorityView({
    scope,
    identity,
    primary,
    secondary,
    tertiary: {
      "client.id": { value: fixture.authorization.clientId },
      "consent.id": { value: fixture.authorization.consentId },
    },
  });
  await assertPriorityView({
    scope,
    identity,
    primary: {
      "authorization.clientName": primary["client.name"],
      "authorization.scopes": primary["consent.scopes"],
    },
    secondary: Object.fromEntries(
      Object.entries(secondary).map(([key, value]) => [
        {
          "client.uri": "authorization.clientUri",
          "client.disabled": "authorization.disabled",
          "consent.updatedAt": "authorization.updatedAt",
          "activity.lastUsedAt": "authorization.usage.lastUsedAt",
          "activity.channel": "authorization.usage.lastChannel",
          "activity.feature": "authorization.usage.lastFeature",
          "activity.readCount": "authorization.usage.readCount",
          "activity.writeCount": "authorization.usage.writeCount",
          "activity.errorCount": "authorization.usage.errorCount",
        }[key],
        value,
      ]),
    ),
    tertiary: {
      "authorization.clientId": { value: fixture.authorization.clientId },
      "authorization.consentId": { value: fixture.authorization.consentId },
    },
  });
}

for (const locale of ["en-us", "zh-cn"] as const)
  for (const width of [1280, 390]) {
    test(`ui.model-property-priority-account-views ${locale}/${width}`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(180_000);
      page.setDefaultTimeout(10_000);
      const fixture = await makeFixture();
      try {
        await page.route("**/images/priority-*.svg", (route) =>
          route.fulfill({
            contentType: "image/svg+xml",
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#357"/></svg>',
          }),
        );
        await page
          .context()
          .addCookies([await createSignedSessionCookie(fixture.user.id)]);

        const copy = locale === "en-us" ? en : zh;
        await page.setViewportSize({ width, height: 900 });
        expect(
          (
            await page.request.post("/api/account/preferences", {
              data: { locale },
            })
          ).status(),
        ).toBe(200);
        await gotoAndWaitForReady(page, "/account/settings/profile");
        await checkProfile(page, fixture);
        await gotoAndWaitForReady(page, "/account/settings/accounts");
        const main = page.locator("#main-content");
        const account = main
          .getByRole("listitem")
          .filter({ has: page.getByText("GitHub", { exact: true }) });
        const passkey = main
          .locator('[data-slot="item"]')
          .filter({ has: page.locator(`#passkey-name-${fixture.passkey.id}`) });
        await page.screenshot({
          path: testInfo.outputPath(`account-fields-${locale}-${width}.png`),
          fullPage: true,
        });
        await assertPriorityView({
          scope: main,
          identity: passkey.locator("input"),
          primary: {
            "account.provider": text(
              account.locator('[data-slot="item-title"]'),
              "GitHub",
            ),
            "account.connected": text(
              account.getByText(copy.profile.connected, { exact: true }),
              copy.profile.connected,
            ),
            "passkey.name": input(passkey.locator("input"), "Priority laptop"),
          },
          secondary: {
            "passkey.createdAt": text(
              passkey.locator("time"),
              dateLabel(locale, fixture.now),
            ),
          },
          tertiary: {
            "passkey.id": { value: fixture.passkey.id },
            "account.id": { value: fixture.account.provider },
          },
        });
        await gotoAndWaitForReady(page, "/account/settings/security");
        const event = page
          .getByRole("listitem")
          .filter({ hasText: "203.0.113.*" });
        await assertPriorityView({
          scope: event,
          identity: event.locator('[data-slot="item-title"]'),
          primary: {
            "event.action": text(
              event.locator('[data-slot="item-title"]'),
              copy.settings.security.actions.account_profile_update,
            ),
            "event.outcome": text(
              event.getByText(copy.settings.security.outcomes.success, {
                exact: true,
              }),
              copy.settings.security.outcomes.success,
            ),
          },
          secondary: {
            "event.createdAt": text(
              event.locator('[data-slot="item-description"]'),
              dateLabel(locale, fixture.now),
            ),
            "event.channel": text(
              event.getByText(copy.settings.security.channels.web, {
                exact: true,
              }),
              copy.settings.security.channels.web,
            ),
            "event.network": text(
              fact(event, copy.settings.security.network),
              "203.0.113.*",
            ),
            "event.device": text(
              fact(event, copy.settings.security.device),
              "Chrome · Windows",
            ),
            "event.client.name": text(
              fact(event, copy.settings.security.client),
              fixture.authorization.name,
            ),
          },
          tertiary: { "event.id": { value: fixture.event.id } },
        });
        await gotoAndWaitForReady(page, "/account/settings/authorizations");
        await page.screenshot({
          path: testInfo.outputPath(
            `authorization-fields-${locale}-${width}.png`,
          ),
          fullPage: true,
        });
        await checkAuthorizations(page, fixture, locale);

        await withE2ePrisma((db) =>
          db.user.update({
            where: { id: fixture.user.id },
            data: { name: "", username: null },
          }),
        );
        await gotoAndWaitForReady(page, "/account/welcome");
        await checkProfile(page, fixture, true);
        await page.getByRole("button", { name: /继续|Continue/i }).click();
        await expect(page).toHaveURL(/step=subscriptions/);
        const semester = await withE2ePrisma((db) =>
          db.semester.findUniqueOrThrow({
            where: { jwId: DEV_SEED.semesterJwId },
          }),
        );
        await page
          .locator("#welcome-bulk-import-semester")
          .selectOption(String(semester.id));
        await page
          .locator("#welcome-bulk-import-section-codes")
          .fill(DEV_SEED.section.code);
        await page
          .getByRole("button", { name: copy.welcome.importButton, exact: true })
          .click();
        const matched = main
          .locator('[data-slot="field"]')
          .filter({ has: page.getByRole("checkbox") });
        const identity = matched.locator('[data-slot="field-label"]');
        const details = matched.locator('[data-slot="field-description"]');
        await assertPriorityView({
          scope: matched,
          identity,
          primary: {
            "section.course.namePrimary": text(
              identity,
              locale === "en-us"
                ? DEV_SEED.course.nameEn
                : DEV_SEED.course.nameCn,
            ),
            "section.teachers.namePrimary": text(
              details,
              locale === "en-us"
                ? DEV_SEED.teacher.nameEn
                : DEV_SEED.teacher.nameCn,
            ),
          },
          secondary: {
            "section.code": text(details, DEV_SEED.section.code),
            "semester.nameCn": text(
              details,
              locale === "en-us" ? "Spring 2026" : DEV_SEED.semesterNameCn,
            ),
          },
          tertiary: {},
        });
        await gotoAndWaitForReady(page, "/account/welcome?step=finish");
        const finish = main.locator("section").filter({
          has: page.getByRole("heading", {
            level: 2,
            name: copy.welcome.finishTitle,
          }),
        });
        await assertPriorityView({
          scope: finish,
          identity: finish.getByRole("heading", { level: 2 }),
          primary: {
            "step.title": text(
              finish.getByRole("heading", { level: 2 }),
              copy.welcome.finishTitle,
            ),
          },
          secondary: {
            "step.description": text(
              finish.getByText(copy.welcome.finishDescription, { exact: true }),
              copy.welcome.finishDescription,
            ),
          },
          tertiary: {},
        });

        await checkOAuthViews(page, fixture, locale);
      } finally {
        await fixture.cleanup();
      }
    });
  }

async function checkOAuthViews(
  page: Page,
  fixture: Fixture,
  locale: "en-us" | "zh-cn",
) {
  const copy = (locale === "en-us" ? en : zh).oauth;
  const main = page.locator("#main-content");
  const challenge = await sha256Base64Url(
    "priority-field-verifier-0123456789012345678901234567890123456789",
  );
  await gotoAndWaitForReady(
    page,
    `/api/auth/oauth2/authorize?${new URLSearchParams({ client_id: fixture.client.clientId, redirect_uri: fixture.client.redirectUris[0], response_type: "code", scope: "openid profile", state: crypto.randomUUID(), prompt: "consent", code_challenge: challenge, code_challenge_method: "S256" })}`,
  );
  const identity = main
    .locator('[data-slot="item-title"]')
    .filter({ hasText: fixture.client.name ?? "" });
  await assertPriorityView({
    scope: main,
    identity,
    primary: {
      "client.name": text(identity, fixture.client.name ?? ""),
      "scopes.name": text(
        main.locator('label[for="oauth-consent-scope-profile"]'),
        oauthScopeLabel(locale, "profile"),
      ),
    },
    secondary: {
      "client.host": text(
        main.getByText(/priority-app\.example\.test/),
        "priority-app.example.test",
      ),
      "redirect.host": text(
        main.getByText(/priority-callback\.example\.test/),
        "priority-callback.example.test",
      ),
    },
    tertiary: {},
  });

  await gotoAndWaitForReady(page, "/oauth/device");
  await page.locator("#code").fill("ABCD1234");
  await assertPriorityView({
    scope: main,
    identity: main.getByRole("heading", { level: 1 }),
    primary: { "device.userCode": input(page.locator("#code"), "ABCD1234") },
    secondary: {},
    tertiary: {},
  });
  const response = await page.request.post(
    "/api/auth/oauth2/device-authorization",
    {
      headers: {
        origin: PLAYWRIGHT_BASE_URL,
        "content-type": "application/x-www-form-urlencoded",
      },
      data: new URLSearchParams({
        client_id: fixture.client.clientId,
        scope: "openid profile",
        resource: `${PLAYWRIGHT_BASE_URL}/api/mcp`,
      }).toString(),
    },
  );
  expect(response.status()).toBe(200);
  const code = (await response.json()) as { verification_uri_complete: string };
  const path = new URL(code.verification_uri_complete);
  await gotoAndWaitForReady(page, `${path.pathname}${path.search}`);
  await assertPriorityView({
    scope: main,
    identity: main.locator("strong"),
    primary: {
      "client.name": text(main.locator("strong"), fixture.client.name ?? ""),
      "scopes.name": text(
        main.getByText("profile", { exact: true }),
        "profile",
      ),
    },
    secondary: {
      "resources.name": text(
        main.getByText(`${PLAYWRIGHT_BASE_URL}/api/mcp`, { exact: true }),
        `${PLAYWRIGHT_BASE_URL}/api/mcp`,
      ),
    },
    tertiary: {},
  });
  await page
    .getByRole("button", { name: copy.deviceApprove, exact: true })
    .click();
  await expect(main.getByRole("heading", { level: 2 })).toHaveText(
    copy.deviceApprovedTitle,
  );
  await assertPriorityView({
    scope: main,
    identity: main.getByRole("heading", { level: 2 }),
    primary: {
      "device.status": text(
        main.getByRole("heading", { level: 2 }),
        copy.deviceApprovedTitle,
      ),
    },
    secondary: {},
    tertiary: {},
  });

  await gotoAndWaitForReady(page, "/admin/oauth");
  await page
    .getByRole("button", { name: copy.createClient, exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .locator("#admin-oauth-client-name")
    .fill("Priority registered application");
  await dialog
    .locator("#admin-oauth-redirect-uris")
    .fill("https://priority-register.example.test/return");
  await dialog
    .getByRole("radio", { name: copy.strategyPublicTitle, exact: true })
    .click();
  await expect(
    dialog.locator('input[name="tokenEndpointAuthMethod"]'),
  ).toHaveValue("none");
  await expect(dialog.locator("#admin-oauth-scope-profile")).toBeChecked();
  await assertPriorityView({
    scope: dialog,
    identity: dialog.locator("#admin-oauth-client-name"),
    primary: {
      "client.name": input(
        dialog.locator("#admin-oauth-client-name"),
        "Priority registered application",
      ),
      "client.pattern": text(
        dialog.getByRole("radio", {
          name: copy.strategyPublicTitle,
          exact: true,
          checked: true,
        }),
        copy.strategyPublicTitle,
      ),
      "client.redirectUris": input(
        dialog.locator("#admin-oauth-redirect-uris"),
        "https://priority-register.example.test/return",
      ),
      "client.scopes": text(
        dialog.locator('label[for="admin-oauth-scope-profile"]'),
        oauthScopeLabel(locale, "profile"),
      ),
    },
    secondary: {},
    tertiary: {},
  });
  await page.keyboard.press("Escape");
}
