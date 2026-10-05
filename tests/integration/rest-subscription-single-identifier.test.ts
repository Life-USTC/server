import { expect } from "vitest";
import { restSubscriptionTest } from "../shared/rest-subscription-contract-fixture";

for (const surface of ["GraphQL", "MCP"] as const) {
  restSubscriptionTest(
    `interface-hierarchy.semantic-parity-15 / ${surface}`,
    { tags: [`@Subscription/${surface}`] },
    async ({
      subscription: { db, origin, fetch, user, createMcpHarness },
      protocolRuntime,
    }) => {
      await protocolRuntime.run(async () => {
        const owner = await user();
        const client = await createMcpHarness(owner.id);
        const base = 1_300_000_000 + Math.floor(Math.random() * 100_000_000);
        const ids = [base, base + 1];
        const source = await db.section.findFirstOrThrow({
          select: { courseId: true, semesterId: true },
        });
        await db.section.createMany({
          data: ids.map((id, index) => ({
            ...source,
            id,
            jwId: ids[1 - index],
            code: `single-id-${id}`,
          })),
        });
        {
          await db.userSectionSubscription.deleteMany({
            where: { userId: owner.id },
          });
          // The second section is a witness: confusing its row ID with the target's JW ID would modify it.
          await db.userSectionSubscription.create({
            data: {
              userId: owner.id,
              sectionId: ids[1],
              kind: "teaching_assistant",
            },
          });
          const witness = await db.userSectionSubscription.findFirstOrThrow({
            where: { userId: owner.id, sectionId: ids[1] },
          });
          for (const action of ["add", "remove"] as const) {
            const jwId = ids[1];
            if (surface === "GraphQL") {
              const field =
                action === "add" ? "subscriptionAdd" : "subscriptionRemove";
              const response = await fetch(`${origin}/api/graphql`, {
                method: "POST",
                headers: {
                  cookie: owner.cookie,
                  origin: "http://localhost:3000",
                  "content-type": "application/json",
                },
                body: JSON.stringify({
                  query: `mutation($jwId:Int!){ ${field}(jwId:$jwId){sectionJwId subscribed} }`,
                  variables: { jwId },
                }),
              });
              expect(response.status).toBe(200);
              expect(await response.json()).toEqual({
                data: {
                  [field]: { sectionJwId: jwId, subscribed: action === "add" },
                },
              });
            } else {
              expect(
                await client.call(`workspace_subscription_${action}`, { jwId }),
              ).toMatchObject({
                success: true,
                sectionJwId: jwId,
                action: action === "add" ? "subscribed" : "unsubscribed",
              });
            }
            expect(
              await db.userSectionSubscription.count({
                where: { userId: owner.id, sectionId: ids[0] },
              }),
            ).toBe(action === "add" ? 1 : 0);
            expect(
              await db.userSectionSubscription.findFirstOrThrow({
                where: { userId: owner.id, sectionId: ids[1] },
              }),
            ).toEqual(witness);
          }
        }
      });
    },
  );
}
