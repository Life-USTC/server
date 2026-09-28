import { expect, type Locator, test } from "@playwright/test";
import {
  cleanupAdminPriorityFixture,
  createAdminPriorityFixture,
} from "../../../utils/admin-priority-fixture";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import {
  assertPriorityView,
  type PriorityViewCheck,
} from "../../../utils/property-priority";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";

function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error("Missing priority fixture field");
  return value;
}

for (const locale of ["en-us", "zh-cn"] as const)
  for (const width of [390, 1280]) {
    test(`ui.model-property-priority-admin-views ${locale}/${width}`, async ({
      page,
      baseURL,
    }, testInfo) => {
      test.setTimeout(240_000);
      page.setDefaultTimeout(10_000);
      if (!baseURL) throw new Error("Missing Playwright baseURL");
      const f = await createAdminPriorityFixture();
      try {
        await page
          .context()
          .addCookies([await createSignedSessionCookie(f.admin.id)]);

        await page
          .context()
          .addCookies([{ name: "NEXT_LOCALE", value: locale, url: baseURL }]);
        const en = locale === "en-us";
        const date = (value: Date) =>
          new Intl.DateTimeFormat(locale, {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Shanghai",
          }).format(value);

        await page.setViewportSize({ width, height: 900 });

        const row = (title: string) =>
          page
            .locator(
              width < 1280
                ? 'main [data-slot="admin-list-shell"] [data-slot="item"]'
                : "main table:visible tbody tr",
            )
            .filter({ hasText: title })
            .first();
        const field = (scope: Locator, value: string, exact = false) => ({
          locator: scope.getByText(value, { exact }).first(),
          expected: value,
        });
        async function check(
          input: PriorityViewCheck,
          title: string,
          label: string,
        ) {
          await input.scope.screenshot({
            path: testInfo.outputPath(`admin-${locale}-${width}-${label}.png`),
          });
          try {
            await expect(input.identity).toContainText(title);
            await assertPriorityView(input);
          } catch (error) {
            expect
              .soft(error, `${locale}/${width}/${label}: ${String(error)}`)
              .toBeUndefined();
          }
        }
        const identity = (scope: Locator, title: string) =>
          width < 1280
            ? scope.locator('[data-slot="item-title"]')
            : scope
                .locator("td")
                .first()
                .getByText(title, { exact: true })
                .first();

        await gotoAndWaitForReady(
          page,
          `/admin/users?search=${f.author.username}`,
        );
        let scope = row(required(f.author.name));
        await check(
          {
            scope,
            identity: identity(scope, required(f.author.name)),
            primary: {
              "user.name": field(scope, required(f.author.name)),
              "user.email": field(scope, required(f.author.email)),
            },
            secondary: {
              "user.username": field(scope, required(f.author.username)),
              "user.createdAt": field(scope, date(f.author.createdAt)),
              "user.isAdmin": field(scope, en ? "User" : "用户", true),
              "user.activeSuspension": field(
                scope,
                en ? "Suspended" : "已封禁",
                true,
              ),
            },
            tertiary: { "user.id": { value: f.author.id } },
          },
          required(f.author.name),
          "users",
        );

        await gotoAndWaitForReady(page, "/admin/oauth");
        scope = row(required(f.client.name));
        await check(
          {
            scope,
            identity: identity(scope, required(f.client.name)),
            primary: {
              "client.name": field(scope, required(f.client.name)),
              "client.clientId": field(scope, f.client.clientId),
            },
            secondary: {
              "client.skipConsent": field(
                scope,
                en ? "Consent required" : "需用户授权",
                true,
              ),
              "client.tokenEndpointAuthMethod": field(
                scope,
                en ? "Public (PKCE)" : "公共客户端（PKCE）",
                true,
              ),
              "client.disabled": field(scope, en ? "Enabled" : "已启用", true),
              "client.scopes": field(scope, "catalog:read", true),
              "client.createdAt": field(
                scope,
                date(required(f.client.createdAt)),
              ),
            },
            tertiary: { "client.id": { value: f.client.id } },
          },
          required(f.client.name),
          "clients",
        );

        await gotoAndWaitForReady(page, "/admin/bus");
        scope = row(f.bus.title);
        await check(
          {
            scope,
            identity: identity(scope, f.bus.title),
            primary: { "version.title": field(scope, f.bus.title) },
            secondary: {
              "version.sourceMessage": field(
                scope,
                required(f.bus.sourceMessage),
              ),
              "version.key": field(scope, f.bus.key),
              "version.tripCount": field(scope, "0", true),
              "version.importedAt": field(scope, date(f.bus.importedAt)),
              "version.effectiveFrom": field(scope, "2026-02-01"),
              "version.effectiveUntil": field(scope, "2026-12-31"),
              "version.isEnabled": field(
                scope,
                en ? "Inactive" : "未激活",
                true,
              ),
            },
            tertiary: { "version.id": { value: String(f.bus.id) } },
          },
          f.bus.title,
          "bus",
        );

        await gotoAndWaitForReady(
          page,
          "/admin/moderation?tab=comments&status=softbanned&search=Priority%20review%20comment",
        );
        scope = row(f.comment.body);
        for (const feature of ["admin", "comment"]) {
          await check(
            {
              scope,
              identity: identity(scope, f.comment.body),
              primary: {
                "comment.body": field(scope, f.comment.body),
                "comment.status": field(
                  scope,
                  en ? "Private" : "仅自己可见",
                  true,
                ),
              },
              secondary: {
                [feature === "admin"
                  ? "comment.user.name"
                  : "comment.author.name"]: field(
                  scope,
                  required(f.author.name),
                ),
                "comment.target": field(
                  scope,
                  `${f.course.nameCn} ${f.section.code}`,
                ),
                "comment.createdAt": field(scope, date(f.comment.createdAt)),
              },
              tertiary: { "comment.id": { value: f.comment.id } },
            },
            f.comment.body,
            `${feature}-comments`,
          );
        }

        await gotoAndWaitForReady(
          page,
          "/admin/moderation?tab=descriptions&search=Priority%20review",
        );
        for (const description of [f.description, f.fallbackDescription]) {
          scope = row(required(description.content));
          for (const feature of ["admin", "description"]) {
            await check(
              {
                scope,
                identity: identity(scope, required(description.content)),
                primary: {
                  "description.content": field(
                    scope,
                    required(description.content),
                  ),
                },
                secondary: {
                  "description.target": field(
                    scope,
                    `${f.course.nameCn} ${description.id === f.description.id ? f.course.code : f.section.code}`,
                  ),
                  "description.lastEditedBy.name": field(
                    scope,
                    required(f.author.name),
                  ),
                  "display.editedAt": field(
                    scope,
                    date(description.lastEditedAt ?? description.updatedAt),
                  ),
                },
                tertiary: {
                  "description.id": { value: description.id },
                  "description.updatedAt": {
                    value: description.updatedAt.toISOString(),
                  },
                },
              },
              required(description.content),
              `${feature}-descriptions-${description.lastEditedAt ? "edited" : "fallback"}`,
            );
          }
        }

        await gotoAndWaitForReady(
          page,
          "/admin/moderation?tab=homeworks&search=Priority%20review",
        );
        scope = row(f.homework.title);
        await check(
          {
            scope,
            identity: identity(scope, f.homework.title),
            primary: {
              "homework.title": field(scope, f.homework.title),
              "homework.status": field(scope, en ? "Active" : "正常", true),
            },
            secondary: {
              "section.code": field(scope, f.section.code),
              "homework.creator.name": field(scope, required(f.author.name)),
              "homework.createdAt": field(scope, date(f.homework.createdAt)),
            },
            tertiary: { "homework.id": { value: f.homework.id } },
          },
          f.homework.title,
          "homeworks",
        );
      } finally {
        await cleanupAdminPriorityFixture(f);
      }
    });
  }
