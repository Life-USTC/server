import { expect } from "@playwright/test";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../../utils/page-ready";
import { test } from "../../../../utils/private-calendar-fixture";
import {
  expectMcpToolCalls,
  expectSubscriptionState,
  signInSubscriptionOwner,
  subscribedCourseLink,
  verifySectionSubscriptionWrite,
} from "../../../../utils/subscription-consumption";
import {
  createSubscriptionMutationFixture,
  expectMissingSubscriptionKind,
  expectSubscriptionRelations,
  mutateSubscription,
  runSubscriptionScenario,
  type SubscriptionRelation,
  subscriptionTransports,
} from "../../../../utils/subscription-mutations";

for (const transport of subscriptionTransports) {
  for (const role of ["regular", "suspended admin"] as const) {
    for (const action of ["add", "kind", "remove"] as const) {
      test(`${transport}: ${role} ${action} preserves other owners`, {
        tag: `@Subscription/${transport === "MCP bearer" && action !== "kind" ? "Web" : transport.split(" ")[0]}`,
      }, async ({ page, calendarProtocolRun, oauthOwner, createCalendar }) => {
        test.setTimeout(90_000);
        await runSubscriptionScenario(
          { page, calendarProtocolRun, oauthOwner, createCalendar },
          {
            transport,
            role,
            messages: 1,
            sdkTools:
              transport === "MCP bearer"
                ? [
                    `workspace_subscription_${action === "kind" ? "kind_update" : action}`,
                  ]
                : [],
          },
          async (connection, fixture) => {
            const db = oauthOwner.worker.database.owner;
            const membership = {
              userId: fixture.own.users[0].id,
              sectionId: fixture.foreign.section.id,
              kind: "regular" as const,
            };
            // Update and delete arrange their own existing membership directly;
            // neither depends on a successful add through any product interface.
            if (action !== "add")
              await db.userSectionSubscription.create({ data: membership });
            await expectSubscriptionRelations(fixture, [
              ...fixture.initial,
              ...(action === "add" ? [] : [membership]),
            ]);
            const refresh = transport === "MCP bearer" && action !== "kind";
            if (refresh) {
              await gotoAndWaitForReady(page, "/workspace/subscriptions");
              await expect(
                subscribedCourseLink(page, fixture.foreign),
              ).toHaveCount(action === "add" ? 0 : 1);
            }
            await mutateSubscription(
              connection,
              fixture,
              action,
              action !== "add",
            );
            const expected: SubscriptionRelation[] = [...fixture.initial];
            if (action !== "remove")
              expected.push({
                ...membership,
                kind: action === "kind" ? "auditor" : "regular",
              });
            await expectSubscriptionRelations(fixture, expected);
            if (refresh) {
              // Refresh is the promised synchronization point for an open view.
              await page.reload();
              await waitForUiSettled(page);
              await expect(
                subscribedCourseLink(page, fixture.foreign),
              ).toHaveCount(action === "add" ? 1 : 0);
              if (action === "add")
                await expect(
                  subscribedCourseLink(page, fixture.foreign),
                ).toHaveText(String(fixture.foreign.course.nameEn));
            }
            return expected;
          },
        );
      });
    }
  }

  test(`${transport}: adding an existing personal subscription preserves memberships`, {
    tag: `@Subscription/${transport.split(" ")[0]}`,
  }, async ({ page, calendarProtocolRun, oauthOwner, createCalendar }) => {
    test.setTimeout(90_000);
    await runSubscriptionScenario(
      { page, calendarProtocolRun, oauthOwner, createCalendar },
      {
        transport,
        messages: 1,
        sdkTools:
          transport === "MCP bearer" ? ["workspace_subscription_add"] : [],
      },
      async (connection, fixture) => {
        const db = oauthOwner.worker.database.owner;
        const membership = {
          userId: fixture.own.users[0].id,
          sectionId: fixture.foreign.section.id,
          kind: "auditor" as const,
        };
        const existing = await db.userSectionSubscription.create({
          data: membership,
        });
        const expected = [...fixture.initial, membership];
        await expectSubscriptionRelations(fixture, expected);
        await mutateSubscription(connection, fixture, "add", true);
        await expectSubscriptionRelations(fixture, expected);
        // Repeating add must preserve both the chosen kind and creation timestamp.
        expect(
          await db.userSectionSubscription.findUniqueOrThrow({
            where: {
              userId_sectionId: {
                userId: membership.userId,
                sectionId: membership.sectionId,
              },
            },
          }),
        ).toEqual(existing);
        return expected;
      },
    );
  });

  for (const action of ["kind", "remove"] as const) {
    test(`${transport}: ${action} of an absent personal subscription preserves memberships`, {
      tag: `@Subscription/${transport.split(" ")[0]}`,
    }, async ({ page, calendarProtocolRun, oauthOwner, createCalendar }) => {
      test.setTimeout(90_000);
      await runSubscriptionScenario(
        { page, calendarProtocolRun, oauthOwner, createCalendar },
        {
          transport,
          messages: action === "kind" ? 0 : 1,
          sdkTools:
            transport === "MCP bearer"
              ? [
                  `workspace_subscription_${action === "kind" ? "kind_update" : action}`,
                ]
              : [],
        },
        async (connection, fixture) => {
          if (action === "kind")
            await expectMissingSubscriptionKind(
              connection,
              fixture.foreign.section.jwId,
            );
          else await mutateSubscription(connection, fixture, "remove", false);
          return fixture.initial;
        },
      );
    });
  }
}

for (const role of ["regular", "suspended admin"] as const) {
  for (const action of ["add", "remove"] as const) {
    test(`Web: ${role} ${action} refreshes the section subscription state`, {
      tag: "@Subscription/Web",
    }, async ({ page, calendarProtocolRun, oauthOwner, createCalendar }) => {
      let sectionJwId = 0;
      const writes: string[] = [];
      await calendarProtocolRun(
        async ({ observeCalendar }) => {
          const fixture = await createSubscriptionMutationFixture(
            oauthOwner,
            createCalendar,
            role,
          );
          const worker = oauthOwner.worker;
          const membership = {
            userId: fixture.own.users[0].id,
            sectionId: fixture.foreign.section.id,
            kind: "regular" as const,
          };
          if (action === "remove")
            await worker.database.owner.userSectionSubscription.create({
              data: membership,
            });
          sectionJwId = fixture.foreign.section.jwId;
          await observeCalendar(fixture.own.users[0], [
            { type: "user", userId: membership.userId },
          ]);
          await signInSubscriptionOwner(page, fixture.own, worker);
          await gotoAndWaitForReady(page, `/catalog/sections/${sectionJwId}`);
          const operation =
            action === "add"
              ? "Subscribe to section"
              : "Unsubscribe from section";
          const nextAction =
            action === "add"
              ? "Unsubscribe from section"
              : "Subscribe to section";
          const actionButton = page.getByRole("button", {
            name: operation,
            exact: true,
          });
          await expect(actionButton).toBeVisible();
          await expect(
            page.getByRole("button", { name: nextAction, exact: true }),
          ).toHaveCount(0);
          await actionButton.click();
          if (action === "add") {
            const dialog = page.getByRole("dialog", { name: operation });
            await expect(dialog).toBeVisible();
            await expect(
              dialog
                .getByText(/非官方|非正式|not.*official|not.*enrollment/i)
                .first(),
            ).toBeVisible();
            await dialog
              .getByRole("button", { name: operation, exact: true })
              .click();
          }
          await expect(
            page.getByRole("button", { name: nextAction, exact: true }),
          ).toBeVisible();
          const expected = [
            ...fixture.initial,
            ...(action === "add" ? [membership] : []),
          ];
          await expectSubscriptionRelations(fixture, expected);
          if (action === "add") {
            await page.keyboard.press("Escape");
            await expect(
              page.getByRole("dialog", { name: operation }),
            ).toBeHidden();
          }
          await page.reload();
          await waitForUiSettled(page);
          await expect(
            page.getByRole("button", { name: nextAction, exact: true }),
          ).toBeVisible();
          return {
            async verifyTransport(observation) {
              expectMcpToolCalls(observation, []);
              expect(writes).toEqual([
                action === "add" ? "?/subscribe" : "?/unsubscribe",
              ]);
            },
            async verifyState() {
              await expectSubscriptionRelations(fixture, expected);
              for (const calendar of [fixture.own, fixture.foreign])
                await expectSubscriptionState(
                  calendar,
                  worker,
                  expected
                    .filter(({ userId }) => userId === calendar.users[0].id)
                    .map(({ sectionId, kind }) => ({ sectionId, kind })),
                );
            },
          };
        },
        async (response, request) => {
          writes.push(
            await verifySectionSubscriptionWrite(
              response,
              request,
              sectionJwId,
            ),
          );
        },
      );
    });
  }
}
