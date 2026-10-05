import { expect } from "vitest";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { isolatedNodeTest as test } from "../shared/isolated-node-fixture";

test(
  "oauth.external-account-issuer-identity",
  { tags: ["@OAuth/OAuth"] },
  async ({ isolatedDatabase: { owner: db }, nodeRuntime }) =>
    nodeRuntime.run(async () => {
      const marker = crypto.randomUUID();
      const userId = "identity-owner";
      const otherId = "other-identity-owner";
      const subject = `same-subject-${marker}`;
      const issuers = [
        `https://issuer-a.example/${marker}`,
        `https://issuer-b.example/${marker}`,
      ];
      await db.$transaction(async (tx) => {
        await tx.user.createMany({
          data: [userId, otherId].map((id) => ({
            id,
            email: `${id}@test.invalid`,
          })),
        });
        for (const [index, id] of [userId, otherId].entries()) {
          await tx.account.create({
            data: {
              userId: id,
              provider: "oidc",
              issuer: issuers[index],
              providerAccountId: subject,
            },
          });
        }
      });
      const context = await getBetterAuthInstance().$context;
      for (const [index, id] of [userId, otherId].entries()) {
        const key = { issuer: issuers[index], accountId: subject };
        expect(
          await context.internalAdapter.findAccountByKey(key),
        ).toMatchObject({
          issuer: issuers[index],
          accountId: subject,
          userId: id,
        });
        expect(
          await context.internalAdapter.findAccountOwnerByKey(key),
        ).toMatchObject({ kind: "owned", user: { id } });
      }
      expect(
        await context.internalAdapter.findAccountByKey({
          issuer: "https://unregistered.example",
          accountId: subject,
        }),
      ).toBeNull();
      await expect(
        db.account.create({
          data: {
            userId: otherId,
            provider: "different-alias",
            issuer: issuers[0],
            providerAccountId: subject,
          },
        }),
      ).rejects.toMatchObject({ code: "P2002" });

      expect(await db.account.count()).toBe(2);
    }),
);
