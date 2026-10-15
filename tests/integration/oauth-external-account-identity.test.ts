import { expect } from "vitest";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { isolatedNodeTest as test } from "../shared/isolated-node-fixture";

test(
  "oauth.external-account-issuer-identity",
  { tags: ["@OAuth/Service"] },
  async ({ isolatedDatabase: { owner: db }, nodeRuntime }) =>
    nodeRuntime.run(async () => {
      const marker = crypto.randomUUID();
      const userId = "identity-owner";
      const otherId = "other-identity-owner";
      const subject = `same-subject-${marker}`;
      const providers = ["github", "google"];
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
              provider: providers[index],
              issuer: `https://issuer-${index}.example/${marker}`,
              providerAccountId: subject,
            },
          });
        }
      });
      const context = await getBetterAuthInstance().$context;
      for (const [index, id] of [userId, otherId].entries()) {
        const key = { providerId: providers[index], accountId: subject };
        expect(
          await context.internalAdapter.findAccountByKey(key),
        ).toMatchObject({
          providerId: providers[index],
          accountId: subject,
          userId: id,
        });
        expect(
          await context.internalAdapter.findAccountOwnerByKey(key),
        ).toMatchObject({ kind: "owned", user: { id } });
      }
      expect(
        await context.internalAdapter.findAccountByKey({
          providerId: "unregistered",
          accountId: subject,
        }),
      ).toBeNull();
      // A second row for a provider/subject pair would make the adapter's
      // lookup ambiguous, so the database refuses it even though this one
      // carries a different issuer.
      await expect(
        db.account.create({
          data: {
            userId: otherId,
            provider: providers[0],
            issuer: `https://issuer-replacement.example/${marker}`,
            providerAccountId: subject,
          },
        }),
      ).rejects.toMatchObject({ code: "P2002" });

      expect(await db.account.count()).toBe(2);
    }),
);
