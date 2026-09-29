import { expect } from "vitest";
import { restSubscriptionTest } from "../shared/rest-subscription-contract-fixture";

restSubscriptionTest(
  "openapi.subscription-kind",
  async ({
    subscription: { db, origin, fetch, users, user },
    protocolRuntime,
  }) => {
    await protocolRuntime.run(async () => {
      const owner = await user();
      const other = await user();
      const section = await db.section.findFirstOrThrow({
        where: { retiredAt: null },
      });
      await db.userSectionSubscription.create({
        data: { userId: owner.id, sectionId: section.id, kind: "regular" },
      });
      const patch = (cookie: string, kind: string) =>
        fetch(`${origin}/api/workspace/subscriptions/${section.jwId}`, {
          method: "PATCH",
          headers: { cookie, origin, "content-type": "application/json" },
          body: JSON.stringify({ kind }),
        });
      const absent = await patch(other.cookie, "auditor");
      expect(absent.status).toBe(404);
      expect(await absent.json()).toEqual({ error: "Subscription not found" });
      for (const kind of ["auditor", "teaching_assistant", "regular"]) {
        const response = await patch(owner.cookie, kind);
        expect(response.status, await response.clone().text()).toBe(200);
        expect(await response.json()).toEqual({
          sectionJwId: section.jwId,
          kind,
        });
        const current = await fetch(
          `${origin}/api/workspace/subscriptions/current`,
          { headers: { cookie: owner.cookie } },
        );
        expect(current.status).toBe(200);
        expect((await current.json()).subscription.sections).toMatchObject([
          { jwId: section.jwId, kind },
        ]);
        expect(
          await db.userSectionSubscription.findMany({
            where: { sectionId: section.id, userId: { in: users } },
          }),
        ).toMatchObject([{ userId: owner.id, kind }]);
      }
    });
  },
);
