import { test } from "../../../../utils/private-calendar-fixture";
import {
  expectMissingSubscriptionKind,
  expectSubscriptionRelations,
  mutateSubscription,
  runSubscriptionScenario,
  type SubscriptionRelation,
  subscriptionTransports,
} from "../../../../utils/subscription-mutations";

for (const transport of subscriptionTransports) {
  for (const role of ["regular", "suspended admin"] as const) {
    test(`${transport}: ${role} modifies only personal subscription state`, async ({
      page,
      calendarProtocolRun,
      oauthOwner,
      createCalendar,
    }) => {
      test.setTimeout(90_000);
      await runSubscriptionScenario(
        { page, calendarProtocolRun, oauthOwner, createCalendar },
        {
          transport,
          role,
          messages: 4,
          usage: transport.endsWith("session")
            ? [0, 0, 0]
            : transport === "MCP bearer"
              ? [0, 5, 0]
              : [0, 5, 1],
          sdkTools:
            transport === "MCP bearer"
              ? [
                  "workspace_subscription_kind_update",
                  "workspace_subscription_remove",
                  "workspace_subscription_add",
                  "workspace_subscription_kind_update",
                  "workspace_subscription_remove",
                ]
              : [],
        },
        async (connection, fixture) => {
          const assertState = (extra: SubscriptionRelation[] = []) =>
            expectSubscriptionRelations(fixture, [
              ...fixture.initial,
              ...extra,
            ]);
          await assertState();
          await test.step("Changing another user's subscribed section does not create my membership", async () => {
            await connection.operation(
              transport === "MCP bearer" ? "write" : "write error",
              () =>
                expectMissingSubscriptionKind(
                  connection,
                  fixture.foreign.section.jwId,
                ),
            );
            await assertState();
          });
          await test.step("Removing a section I have not subscribed to leaves every membership intact", async () => {
            await connection.operation("write", () =>
              mutateSubscription(connection, fixture, "remove", false),
            );
            await assertState();
          });
          const membership = {
            userId: fixture.own.users[0].id,
            sectionId: fixture.foreign.section.id,
            kind: "regular" as const,
          };
          await test.step("Adding creates exactly my membership and preserves unrelated owners", async () => {
            await connection.operation("write", () =>
              mutateSubscription(connection, fixture, "add"),
            );
            await assertState([membership]);
          });
          await test.step("Changing kind updates only my membership", async () => {
            await connection.operation("write", () =>
              mutateSubscription(connection, fixture, "kind"),
            );
            await assertState([{ ...membership, kind: "auditor" }]);
          });
          await test.step("Removing deletes only my membership", async () => {
            await connection.operation("write", () =>
              mutateSubscription(connection, fixture, "remove"),
            );
            await assertState();
          });
        },
      );
    });
  }
}
