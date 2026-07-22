import { afterAll, describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

const protectedTables = [
  "BusUserPreference",
  "DashboardLinkClick",
  "DashboardLinkPin",
  "Todo",
] as const;

describe.skipIf(process.env.RLS_TEST_ENABLED !== "true")(
  "PostgreSQL row security contract",
  () => {
    afterAll(async () => {
      await prisma.$disconnect();
    });

    it("uses an unprivileged runtime role that owns none of the protected tables", async () => {
      const [role] = await prisma.$queryRaw<
        {
          currentUser: string;
          superuser: boolean;
          bypassRls: boolean;
          inheritsRoles: boolean;
        }[]
      >(Prisma.sql`
        SELECT
          current_user AS "currentUser",
          rolsuper AS superuser,
          rolbypassrls AS "bypassRls",
          rolinherit AS "inheritsRoles"
        FROM pg_roles
        WHERE rolname = current_user
      `);
      expect(role).toEqual({
        currentUser: "life_ustc_runtime",
        superuser: false,
        bypassRls: false,
        inheritsRoles: false,
      });

      const tables = await prisma.$queryRaw<
        {
          tableName: string;
          owner: string;
          rlsEnabled: boolean;
          rlsForced: boolean;
        }[]
      >(Prisma.sql`
        SELECT
          relname AS "tableName",
          pg_get_userbyid(relowner) AS owner,
          relrowsecurity AS "rlsEnabled",
          relforcerowsecurity AS "rlsForced"
        FROM pg_class
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE nspname = 'public'
          AND relname IN (${Prisma.join(protectedTables)})
        ORDER BY relname
      `);
      expect(tables).toHaveLength(protectedTables.length);
      expect(tables.map(({ tableName }) => tableName)).toEqual([
        ...protectedTables,
      ]);
      for (const table of tables) {
        expect(table).toMatchObject({ rlsEnabled: true, rlsForced: true });
        expect(table.owner).not.toBe(role.currentUser);
      }
    });

    it("keeps one PUBLIC owner policy with matching read and write checks per table", async () => {
      const policies = await prisma.$queryRaw<
        {
          tableName: string;
          policyName: string;
          permissive: string;
          roles: string[];
          command: string;
          usingExpression: string;
          checkExpression: string;
        }[]
      >(Prisma.sql`
        SELECT
          tablename AS "tableName",
          policyname AS "policyName",
          permissive,
          roles::text[] AS roles,
          cmd AS command,
          qual AS "usingExpression",
          with_check AS "checkExpression"
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN (${Prisma.join(protectedTables)})
        ORDER BY tablename, policyname
      `);

      expect(policies).toHaveLength(protectedTables.length);
      for (const policy of policies) {
        expect(policy).toMatchObject({
          policyName: `${policy.tableName}_owner_isolation`,
          permissive: "PERMISSIVE",
          roles: ["public"],
          command: "ALL",
        });
        expect(policy.usingExpression.replaceAll("::text", "")).toBe(
          `("userId" = current_setting('app.user_id', true))`,
        );
        expect(policy.checkExpression.replaceAll("::text", "")).toBe(
          policy.usingExpression.replaceAll("::text", ""),
        );
      }
    });
  },
);
