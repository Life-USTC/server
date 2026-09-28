import { test } from "@playwright/test";
import {
  createSubscriptionMutationFixture,
  expectMissingSubscriptionKind,
  expectSubscriptionRelations,
  mutateSubscription,
  openSubscriptionTransport,
  type SubscriptionRelation,
  subscriptionTransports,
} from "../../../../utils/subscription-mutations";

for (const transport of subscriptionTransports) {
  for (const role of ["regular", "suspended admin"] as const) {
    test(`${transport}: ${role} modifies only personal subscription state`, async ({
      page,
      request,
    }) => {
      test.setTimeout(90_000);
      const fixture = await createSubscriptionMutationFixture(role);
      let connection:
        | Awaited<ReturnType<typeof openSubscriptionTransport>>
        | undefined;
      try {
        connection = await openSubscriptionTransport(
          page,
          request,
          fixture.own.users[0].id,
          transport,
        );
        const activeConnection = connection;
        const assertState = (extra: SubscriptionRelation[] = []) =>
          expectSubscriptionRelations(fixture, [...fixture.initial, ...extra]);
        await assertState();
        await test.step("Changing another user's subscribed section does not create my membership", async () => {
          await expectMissingSubscriptionKind(
            activeConnection,
            fixture.foreign.section.jwId,
          );
          await assertState();
        });
        await test.step("Removing a section I have not subscribed to leaves every membership intact", async () => {
          await mutateSubscription(activeConnection, fixture, "remove", false);
          await assertState();
        });
        const membership = {
          userId: fixture.own.users[0].id,
          sectionId: fixture.foreign.section.id,
          kind: "regular" as const,
        };
        await test.step("Adding creates exactly my membership and preserves unrelated owners", async () => {
          await mutateSubscription(activeConnection, fixture, "add");
          await assertState([membership]);
        });
        await test.step("Changing kind updates only my membership", async () => {
          await mutateSubscription(activeConnection, fixture, "kind");
          await assertState([{ ...membership, kind: "auditor" }]);
        });
        await test.step("Removing deletes only my membership", async () => {
          await mutateSubscription(activeConnection, fixture, "remove");
          await assertState();
        });
      } finally {
        await connection?.close();
        await fixture.cleanup();
      }
    });
  }
}
