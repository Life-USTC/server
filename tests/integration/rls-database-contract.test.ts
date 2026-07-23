import { afterAll, describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

const protectedTables = [
  "BusUserPreference",
  "DashboardLinkClick",
  "DashboardLinkPin",
  "Todo",
] as const;

// This mirrors only the temporary CI role bootstrap. Issue #603 must replace
// the account-deletion grants with separately owned production roles.
const expectedRuntimeTablePrivileges = [
  "AuditLog:SELECT",
  "AuditLog:UPDATE",
  "BusCampus:SELECT",
  "BusUserPreference:DELETE",
  "BusUserPreference:INSERT",
  "BusUserPreference:SELECT",
  "BusUserPreference:UPDATE",
  "DashboardLinkClick:DELETE",
  "DashboardLinkClick:INSERT",
  "DashboardLinkClick:SELECT",
  "DashboardLinkClick:UPDATE",
  "DashboardLinkPin:DELETE",
  "DashboardLinkPin:INSERT",
  "DashboardLinkPin:SELECT",
  "DashboardLinkPin:UPDATE",
  "Todo:DELETE",
  "Todo:INSERT",
  "Todo:SELECT",
  "Todo:UPDATE",
  "User:DELETE",
  "User:SELECT",
  "UserSuspension:SELECT",
  "UserSuspension:UPDATE",
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

    it("keeps the temporary CI runtime grants on an exact allowlist", async () => {
      const grants = await prisma.$queryRaw<
        { tableName: string; privilege: string }[]
      >(Prisma.sql`
        SELECT
          table_name AS "tableName",
          privilege_type AS privilege
        FROM information_schema.role_table_grants
        WHERE grantee = current_user
          AND table_schema = 'public'
        ORDER BY table_name, privilege_type
      `);

      expect(
        grants.map(({ tableName, privilege }) => `${tableName}:${privilege}`),
      ).toEqual(expectedRuntimeTablePrivileges);

      const effectiveGrants = await prisma.$queryRaw<
        { tableName: string; privilege: string }[]
      >(Prisma.sql`
        SELECT
          pg_class.relname AS "tableName",
          candidate.privilege
        FROM pg_class
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        CROSS JOIN (
          VALUES ('DELETE'), ('INSERT'), ('REFERENCES'), ('SELECT'),
                 ('TRIGGER'), ('TRUNCATE'), ('UPDATE')
        ) AS candidate(privilege)
        WHERE pg_namespace.nspname = 'public'
          AND pg_class.relkind IN ('r', 'p')
          AND has_table_privilege(
            current_user,
            format('%I.%I', pg_namespace.nspname, pg_class.relname),
            candidate.privilege
          )
        ORDER BY pg_class.relname, candidate.privilege
      `);
      expect(
        effectiveGrants.map(
          ({ tableName, privilege }) => `${tableName}:${privilege}`,
        ),
      ).toEqual(expectedRuntimeTablePrivileges);

      const [schemaPrivileges] = await prisma.$queryRaw<
        { canCreate: boolean; canUse: boolean }[]
      >(Prisma.sql`
        SELECT
          has_schema_privilege(current_user, 'public', 'CREATE') AS "canCreate",
          has_schema_privilege(current_user, 'public', 'USAGE') AS "canUse"
      `);
      expect(schemaPrivileges).toEqual({ canCreate: false, canUse: true });
    });

    it("cannot inherit or SET ROLE through memberships or future default grants", async () => {
      const memberships = await prisma.$queryRaw<
        { grantedRole: string }[]
      >(Prisma.sql`
        SELECT parent.rolname AS "grantedRole"
        FROM pg_auth_members
        JOIN pg_roles member ON member.oid = pg_auth_members.member
        JOIN pg_roles parent ON parent.oid = pg_auth_members.roleid
        WHERE member.rolname = current_user
        ORDER BY parent.rolname
      `);
      expect(memberships).toEqual([]);

      const defaultPrivileges = await prisma.$queryRaw<
        { owner: string; objectType: string; privilege: string }[]
      >(Prisma.sql`
        SELECT
          owner.rolname AS owner,
          defaults.defaclobjtype::text AS "objectType",
          acl.privilege_type AS privilege
        FROM pg_default_acl defaults
        JOIN pg_roles owner ON owner.oid = defaults.defaclrole
        CROSS JOIN LATERAL aclexplode(defaults.defaclacl) acl
        WHERE acl.grantee IN (
          0,
          (SELECT oid FROM pg_roles WHERE rolname = current_user)
        )
        ORDER BY owner.rolname, defaults.defaclobjtype, acl.privilege_type
      `);
      expect(defaultPrivileges).toEqual([]);
    });
  },
);
