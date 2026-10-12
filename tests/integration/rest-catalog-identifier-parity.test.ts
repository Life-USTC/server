import { expect } from "vitest";
import { restSubscriptionTest } from "../shared/rest-subscription-contract-fixture";

for (const domain of ["Course", "Section", "Subscription"] as const) {
  for (const transport of ["REST", "GraphQL", "MCP"] as const) {
    restSubscriptionTest(
      `interface-hierarchy.semantic-parity-12 / ${domain} / ${transport}`,
      { tags: [`@${domain}/${transport}`] },
      async ({
        subscription: { db, origin, fetch, user, createMcpHarness },
        protocolRuntime,
      }) => {
        await protocolRuntime.run(async () => {
          const owner = await user();
          const client = await createMcpHarness(owner.id);
          const base = 1_100_000_000 + Math.floor(Math.random() * 100_000_000);
          const semester = await db.semester.findFirstOrThrow();
          const courseIds = [base, base + 1];
          const sectionIds = [base + 2, base + 3];
          await db.course.createMany({
            data: courseIds.map((id, index) => ({
              id,
              jwId: courseIds[1 - index],
              code: `id-contract-${id}`,
              nameCn: `ID contract ${id}`,
            })),
          });
          await db.section.createMany({
            data: sectionIds.map((id, index) => ({
              id,
              jwId: sectionIds[1 - index],
              courseId: courseIds[index],
              semesterId: semester.id,
              code: `id-contract-${id}`,
            })),
          });
          await db.userSectionSubscription.createMany({
            data: sectionIds.map((sectionId) => ({
              userId: owner.id,
              sectionId,
              kind: "regular" as const,
            })),
          });
          const graph = async (
            query: string,
            variables: Record<string, unknown>,
          ) => {
            const response = await fetch(`${origin}/api/graphql`, {
              method: "POST",
              headers: {
                cookie: owner.cookie,
                origin: "http://localhost:3000",
                "content-type": "application/json",
              },
              body: JSON.stringify({ query, variables }),
            });
            const result = await response.json();
            expect(response.status, JSON.stringify(result)).toBe(200);
            expect(result.errors).toBeUndefined();
            return result.data;
          };
          if (domain !== "Subscription") {
            for (const [kind, ids] of [
              ["course", courseIds],
              ["section", sectionIds],
            ] as const) {
              if ((kind === "course" ? "Course" : "Section") !== domain)
                continue;
              for (const [index, id] of ids.entries()) {
                const jwId = ids[1 - index];
                if (transport === "REST") {
                  const response = await fetch(
                    `${origin}/api/catalog/${kind}s/${jwId}`,
                  );
                  expect(response.status).toBe(200);
                  expect(await response.json()).toMatchObject({
                    id,
                    jwId,
                    code: `id-contract-${id}`,
                  });
                }
                if (transport === "GraphQL") {
                  const data = await graph(
                    `query($jwId: Int!) { catalog { ${kind}(jwId: $jwId) { id jwId code } } }`,
                    { jwId },
                  );
                  expect(data.catalog[kind]).toEqual({
                    id,
                    jwId,
                    code: `id-contract-${id}`,
                  });
                }
                if (transport === "MCP") {
                  const mcp = await client.call(`catalog_${kind}_get`, {
                    jwId,
                    mode: "full",
                  });
                  expect(mcp).toMatchObject({
                    found: true,
                    [kind]: { id, jwId, code: `id-contract-${id}` },
                  });
                }
              }
            }
          }
          if (domain === "Subscription") {
            await db.userSectionSubscription.updateMany({
              where: { userId: owner.id },
              data: { kind: "regular" },
            });
            const jwId = sectionIds[1];
            if (transport === "REST") {
              const response = await fetch(
                `${origin}/api/workspace/subscriptions/${jwId}`,
                {
                  method: "PATCH",
                  headers: {
                    cookie: owner.cookie,
                    origin,
                    "content-type": "application/json",
                  },
                  body: JSON.stringify({ kind: "auditor" }),
                },
              );
              expect(response.status).toBe(200);
              expect(await response.json()).toEqual({
                sectionJwId: jwId,
                kind: "auditor",
              });
            } else if (transport === "GraphQL") {
              expect(
                await graph(
                  `mutation($jwId: Int!) { subscriptionKindUpdate(jwId: $jwId, kind: auditor) { sectionJwId kind } }`,
                  { jwId },
                ),
              ).toEqual({
                subscriptionKindUpdate: { sectionJwId: jwId, kind: "auditor" },
              });
            } else {
              expect(
                await client.call("workspace_subscription_kind_update", {
                  jwId,
                  kind: "auditor",
                }),
              ).toMatchObject({ sectionJwId: jwId, kind: "auditor" });
            }
            expect(
              await db.userSectionSubscription.findMany({
                where: { userId: owner.id },
                select: { sectionId: true, kind: true },
                orderBy: { sectionId: "asc" },
              }),
            ).toEqual([
              { sectionId: sectionIds[0], kind: "auditor" },
              { sectionId: sectionIds[1], kind: "regular" },
            ]);
          }
        });
      },
    );
  }
}
