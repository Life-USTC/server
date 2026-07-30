import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestPrisma, disconnectTestPrisma } from "../shared/prisma";

const prisma = createTestPrisma();
const marker = `settings-unlink-${crypto.randomUUID()}`;
let userId: string;

async function unlink(provider: string) {
  const [result] = await prisma.$queryRaw<{ status: string }[]>`
    SELECT public.unlink_settings_account(${userId}, ${provider}) AS status
  `;
  return result.status;
}

describe("settings account unlink database boundary", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `${marker}@example.test`,
        name: marker,
        accounts: {
          create: [
            {
              issuer: "https://github.com",
              provider: "github",
              providerAccountId: `${marker}-github`,
            },
            {
              issuer: "https://accounts.google.com",
              provider: "google",
              providerAccountId: `${marker}-google`,
            },
          ],
        },
        verifiedEmails: {
          create: {
            email: `${marker}-github@example.test`,
            provider: "github",
          },
        },
      },
      select: { id: true },
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    await disconnectTestPrisma(prisma);
  });

  it("uses a locked-down security-definer function", async () => {
    const [definition] = await prisma.$queryRaw<
      Array<{
        publicCanExecute: boolean;
        securityDefiner: boolean;
        settings: string[] | null;
      }>
    >`
      SELECT
        procedure.prosecdef AS "securityDefiner",
        procedure.proconfig AS settings,
        EXISTS (
          SELECT 1
          FROM pg_catalog.aclexplode(
            COALESCE(
              procedure.proacl,
              pg_catalog.acldefault('f'::"char", procedure.proowner)
            )
          ) AS privilege
          WHERE privilege.grantee = 0
            AND privilege.privilege_type = 'EXECUTE'
        ) AS "publicCanExecute"
      FROM pg_catalog.pg_proc AS procedure
      WHERE procedure.oid = pg_catalog.to_regprocedure(
        'public.unlink_settings_account(text,text)'
      )
    `;

    expect(definition).toEqual({
      publicCanExecute: false,
      securityDefiner: true,
      settings: ['search_path=""'],
    });
  });

  it("atomically removes one provider but never the last account", async () => {
    await expect(unlink("github")).resolves.toBe("unlinked");
    await expect(unlink("google")).resolves.toBe("last_account");
    await expect(unlink("missing")).resolves.toBe("not_linked");

    await expect(
      prisma.account.findMany({
        where: { userId },
        select: { provider: true },
      }),
    ).resolves.toEqual([{ provider: "google" }]);
    await expect(
      prisma.verifiedEmail.count({
        where: { userId, provider: "github" },
      }),
    ).resolves.toBe(0);
  });
});
