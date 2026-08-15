import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createTestPrisma, disconnectTestPrisma } from "../shared/prisma";

function loadPrivilegeAllowlist(
  client: PrismaClient,
  scriptPath: string,
): Promise<string[]> {
  const sql = readFileSync(join(process.cwd(), scriptPath), "utf8").replace(
    /\\set ON_ERROR_STOP on\n?/,
    "",
  );

  return client.$queryRawUnsafe<Record<string, string>[]>(sql).then((rows) => {
    const value = Object.values(rows[0] ?? {})[0] ?? "";
    return value.length === 0 ? [] : value.split(",");
  });
}

const adminPrisma = createTestPrisma(
  process.env.FUNCTION_OWNER_DATABASE_URL ?? process.env.DATABASE_URL,
);

const protectedTables = [
  "BusUserPreference",
  "CommentReaction",
  "DashboardLinkClick",
  "DashboardLinkPin",
  "HomeworkCompletion",
  "Todo",
  "Upload",
  "UploadPending",
] as const;

const expectedRuntimeFunctionPrivileges = [
  "public.claim_upload_pending_storage_cleanup(p_now timestamp without time zone, p_batch_size integer, p_lease_seconds integer):EXECUTE",
  "public.comment_attachment_summaries(p_comment_ids text[]):EXECUTE",
  "public.comment_hidden_root_count(p_section_id integer, p_course_id integer, p_teacher_id integer, p_homework_id text, p_section_teacher_id integer):EXECUTE",
  "public.comment_reaction_summaries(comment_ids text[]):EXECUTE",
  "public.finalize_upload_pending_storage_cleanup(p_id text, p_attempt_id text):EXECUTE",
  "public.find_downloadable_upload(p_upload_id text):EXECUTE",
  "public.get_public_profile_section_subscription_count(p_user_id text):EXECUTE",
  "public.get_public_profile_upload_stats(p_user_id text, p_since timestamp without time zone):EXECUTE",
  "public.release_upload_pending_storage_cleanup(p_id text, p_attempt_id text, p_now timestamp without time zone, p_retry_lease_seconds integer):EXECUTE",
] as const;

describe.skipIf(process.env.RLS_TEST_ENABLED !== "true")(
  "PostgreSQL row security contract",
  () => {
    afterAll(async () => {
      await Promise.all([
        prisma.$disconnect(),
        disconnectTestPrisma(adminPrisma),
      ]);
    });

    it("uses an unprivileged runtime role that owns none of the protected tables", async () => {
      const [role] = await prisma.$queryRaw<
        {
          currentUser: string;
          sessionUser: string;
          canLogin: boolean;
          canCreateDatabase: boolean;
          canCreateRole: boolean;
          superuser: boolean;
          bypassRls: boolean;
          inheritsRoles: boolean;
          replication: boolean;
        }[]
      >(Prisma.sql`
        SELECT
          current_user AS "currentUser",
          session_user AS "sessionUser",
          rolcanlogin AS "canLogin",
          rolcreatedb AS "canCreateDatabase",
          rolcreaterole AS "canCreateRole",
          rolsuper AS superuser,
          rolbypassrls AS "bypassRls",
          rolinherit AS "inheritsRoles",
          rolreplication AS replication
        FROM pg_roles
        WHERE rolname = current_user
      `);
      expect(role).toEqual({
        currentUser: "life_ustc_runtime",
        sessionUser: "life_ustc_runtime",
        canLogin: true,
        canCreateDatabase: false,
        canCreateRole: false,
        superuser: false,
        bypassRls: false,
        inheritsRoles: false,
        replication: false,
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

    it("keeps exactly one runtime-applicable owner policy per table", async () => {
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
          AND roles && ARRAY['public'::name, current_user::name]
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
          `("userId" = NULLIF(current_setting('app.user_id', true), ''))`,
        );
        expect(policy.checkExpression.replaceAll("::text", "")).toBe(
          policy.usingExpression.replaceAll("::text", ""),
        );
      }
    });

    it("treats an empty transaction-local user context as missing", async () => {
      const emptyOwnerTodoId = "rls-empty-owner-todo";
      await adminPrisma.user.upsert({
        where: { id: "" },
        update: { email: "rls-empty-owner@example.invalid" },
        create: {
          id: "",
          email: "rls-empty-owner@example.invalid",
          name: "RLS empty owner probe",
        },
      });
      await adminPrisma.todo.upsert({
        where: { id: emptyOwnerTodoId },
        update: { title: "RLS empty owner probe" },
        create: {
          id: emptyOwnerTodoId,
          title: "RLS empty owner probe",
          userId: "",
        },
      });

      try {
        const result = await prisma.$transaction(async (tx) => {
          await tx.$queryRaw`
            SELECT set_config('app.user_id', '', true)
          `;
          return {
            row: await tx.todo.findUnique({
              where: { id: emptyOwnerTodoId },
              select: { id: true },
            }),
            update: await tx.todo.updateMany({
              where: { id: emptyOwnerTodoId },
              data: { completed: true },
            }),
          };
        });

        expect(result).toEqual({ row: null, update: { count: 0 } });
      } finally {
        await adminPrisma.todo.deleteMany({
          where: { id: emptyOwnerTodoId },
        });
        await adminPrisma.user.deleteMany({ where: { id: "" } });
      }
    });

    it("keeps the temporary CI runtime grants on the export privilege contract", async () => {
      const expectedRuntimeTablePrivileges = await loadPrivilegeAllowlist(
        prisma,
        "prisma/roles/export-app-runtime-table-privileges.sql",
      );

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
        grants.map(
          ({ tableName, privilege }) => `public.${tableName}:${privilege}`,
        ),
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
          ({ tableName, privilege }) => `public.${tableName}:${privilege}`,
        ),
      ).toEqual(expectedRuntimeTablePrivileges);

      const functionGrants = await prisma.$queryRaw<
        { signature: string }[]
      >(Prisma.sql`
        SELECT format(
          '%s.%s(%s):%s',
          namespace.nspname,
          procedure.proname,
          pg_get_function_identity_arguments(procedure.oid),
          privilege.privilege_type
        ) AS signature
        FROM pg_proc AS procedure
        JOIN pg_namespace AS namespace
          ON namespace.oid = procedure.pronamespace
        JOIN LATERAL aclexplode(procedure.proacl) AS privilege
          ON privilege.grantee = (
            SELECT oid FROM pg_roles WHERE rolname = current_user
          )
        WHERE namespace.nspname = 'public'
        ORDER BY signature
      `);
      expect(functionGrants.map(({ signature }) => signature)).toEqual(
        expectedRuntimeFunctionPrivileges,
      );

      const [schemaPrivileges] = await prisma.$queryRaw<
        { canCreate: boolean; canUse: boolean }[]
      >(Prisma.sql`
        SELECT
          has_schema_privilege(current_user, 'public', 'CREATE') AS "canCreate",
          has_schema_privilege(current_user, 'public', 'USAGE') AS "canUse"
      `);
      expect(schemaPrivileges).toEqual({ canCreate: false, canUse: true });

      const [databasePrivileges] = await prisma.$queryRaw<
        {
          canConnect: boolean;
          canCreate: boolean;
          canCreateTemporaryTables: boolean;
        }[]
      >(Prisma.sql`
        SELECT
          has_database_privilege(
            current_user,
            current_database(),
            'CONNECT'
          ) AS "canConnect",
          has_database_privilege(
            current_user,
            current_database(),
            'CREATE'
          ) AS "canCreate",
          has_database_privilege(
            current_user,
            current_database(),
            'TEMPORARY'
          ) AS "canCreateTemporaryTables"
      `);
      expect(databasePrivileges).toEqual({
        canConnect: true,
        canCreate: false,
        canCreateTemporaryTables: false,
      });

      const publicDatabasePrivileges = await prisma.$queryRaw<
        { privilege: string }[]
      >(Prisma.sql`
        SELECT acl.privilege_type AS privilege
        FROM pg_database
        CROSS JOIN LATERAL aclexplode(
          COALESCE(datacl, acldefault('d', datdba))
        ) AS acl
        WHERE datname = current_database()
          AND acl.grantee = 0
        ORDER BY acl.privilege_type
      `);
      expect(publicDatabasePrivileges).toEqual([]);

      const publicSchemaPrivileges = await prisma.$queryRaw<
        { privilege: string }[]
      >(Prisma.sql`
        SELECT acl.privilege_type AS privilege
        FROM pg_namespace
        CROSS JOIN LATERAL aclexplode(
          COALESCE(nspacl, acldefault('n', nspowner))
        ) AS acl
        WHERE nspname = 'public'
          AND acl.grantee = 0
        ORDER BY acl.privilege_type
      `);
      expect(publicSchemaPrivileges).toEqual([]);
    });

    it("has no role memberships in either direction", async () => {
      const memberships = await prisma.$queryRaw<
        { grantedRole: string }[]
      >(Prisma.sql`
        SELECT parent.rolname AS "grantedRole"
        FROM pg_auth_members
        JOIN pg_roles member ON member.oid = pg_auth_members.member
        JOIN pg_roles parent ON parent.oid = pg_auth_members.roleid
        WHERE member.rolname = current_user OR parent.rolname = current_user
        ORDER BY parent.rolname
      `);
      expect(memberships).toEqual([]);
    });

    it("cannot access authentication-owned tables", async () => {
      const authTables = [
        "Account",
        "DeviceCode",
        "Jwks",
        "OAuthAccessToken",
        "OAuthClient",
        "OAuthConsent",
        "OAuthRefreshToken",
        "Passkey",
        "Session",
        "VerificationToken",
      ];
      const privileges = await prisma.$queryRaw<
        Array<{
          canDelete: boolean;
          canInsert: boolean;
          canSelect: boolean;
          canUpdate: boolean;
        }>
      >(Prisma.sql`
        SELECT
          pg_catalog.has_table_privilege(
            current_user,
            pg_catalog.format('public.%I', table_name),
            'SELECT'
          ) AS "canSelect",
          pg_catalog.has_table_privilege(
            current_user,
            pg_catalog.format('public.%I', table_name),
            'INSERT'
          ) AS "canInsert",
          pg_catalog.has_table_privilege(
            current_user,
            pg_catalog.format('public.%I', table_name),
            'UPDATE'
          ) AS "canUpdate",
          pg_catalog.has_table_privilege(
            current_user,
            pg_catalog.format('public.%I', table_name),
            'DELETE'
          ) AS "canDelete"
        FROM unnest(ARRAY[${Prisma.join(authTables)}]::text[]) AS table_name
      `);

      expect(privileges).toHaveLength(authTables.length);
      for (const privilege of privileges) {
        expect(privilege).toEqual({
          canDelete: false,
          canInsert: false,
          canSelect: false,
          canUpdate: false,
        });
      }
    });
  },
);
