import { afterAll, describe, expect, it } from "vitest";
import { createTestPrisma, disconnectTestPrisma } from "../shared/prisma";

const functionOwnerRole = "life_ustc_function_owner";
const adminPrisma = createTestPrisma(
  process.env.FUNCTION_OWNER_DATABASE_URL ?? process.env.DATABASE_URL,
);

const expectedFunctions = [
  {
    securityDefiner: true,
    settings: ['search_path=""'],
    signature:
      "public.claim_upload_pending_storage_cleanup(p_now timestamp without time zone, p_batch_size integer, p_lease_seconds integer)",
    volatility: "VOLATILE",
  },
  {
    securityDefiner: true,
    settings: ['search_path=""'],
    signature:
      "public.cleanup_expired_auth_records(p_cutoff timestamp without time zone, p_batch_size integer)",
    volatility: "VOLATILE",
  },
  {
    securityDefiner: true,
    settings: ['search_path=""'],
    signature: "public.comment_attachment_summaries(p_comment_ids text[])",
    volatility: "STABLE",
  },
  {
    securityDefiner: true,
    settings: ['search_path=""'],
    signature:
      "public.comment_hidden_root_count(p_section_id integer, p_course_id integer, p_teacher_id integer, p_homework_id text, p_section_teacher_id integer)",
    volatility: "STABLE",
  },
  {
    securityDefiner: true,
    settings: ['search_path=""', "app.comment_reaction_summary=on"],
    signature: "public.comment_reaction_summaries(comment_ids text[])",
    volatility: "STABLE",
  },
  {
    securityDefiner: true,
    settings: ['search_path=""'],
    signature:
      "public.finalize_upload_pending_storage_cleanup(p_id text, p_attempt_id text)",
    volatility: "VOLATILE",
  },
  {
    securityDefiner: true,
    settings: ['search_path=""'],
    signature: "public.find_downloadable_upload(p_upload_id text)",
    volatility: "STABLE",
  },
  {
    securityDefiner: true,
    settings: ['search_path=""', "app.homework_completion_profile=on"],
    signature:
      "public.get_public_profile_homework_completions(p_user_id text, p_since timestamp without time zone)",
    volatility: "STABLE",
  },
  {
    securityDefiner: true,
    settings: ['search_path=""'],
    signature:
      "public.get_public_profile_section_subscription_count(p_user_id text)",
    volatility: "STABLE",
  },
  {
    securityDefiner: true,
    settings: ['search_path=""'],
    signature:
      "public.get_public_profile_upload_stats(p_user_id text, p_since timestamp without time zone)",
    volatility: "STABLE",
  },
  {
    securityDefiner: true,
    settings: ['search_path=""'],
    signature:
      "public.release_upload_pending_storage_cleanup(p_id text, p_attempt_id text, p_now timestamp without time zone, p_retry_lease_seconds integer)",
    volatility: "VOLATILE",
  },
  {
    securityDefiner: true,
    settings: ['search_path=""'],
    signature:
      "public.unlink_settings_account(p_user_id text, p_provider text)",
    volatility: "VOLATILE",
  },
] as const;

const expectedTablePrivileges = [
  "public.Account:DELETE",
  "public.Account:SELECT",
  "public.Comment:SELECT",
  "public.CommentAttachment:SELECT",
  "public.CommentReaction:SELECT",
  "public.DeviceCode:DELETE",
  "public.DeviceCode:SELECT",
  "public.HomeworkCompletion:SELECT",
  "public.OAuthAccessToken:DELETE",
  "public.OAuthAccessToken:SELECT",
  "public.OAuthRefreshToken:DELETE",
  "public.OAuthRefreshToken:SELECT",
  "public.Session:DELETE",
  "public.Session:SELECT",
  "public.Upload:SELECT",
  "public.UploadPending:DELETE",
  "public.UploadPending:SELECT",
  "public.UploadPending:UPDATE",
  "public.User:SELECT",
  "public.VerificationToken:DELETE",
  "public.VerificationToken:SELECT",
  "public.VerifiedEmail:DELETE",
  "public.VerifiedEmail:SELECT",
] as const;

const expectedColumnPrivileges = [
  "public.DeviceCode:id:UPDATE",
  "public.OAuthAccessToken:id:UPDATE",
  "public.OAuthRefreshToken:id:UPDATE",
  "public.Session:id:UPDATE",
  "public.User:id:UPDATE",
  "public.VerificationToken:id:UPDATE",
] as const;

describe.skipIf(process.env.FUNCTION_OWNER_ROLE_TEST_ENABLED !== "true")(
  "security-definer function owner role contract",
  () => {
    afterAll(async () => {
      await disconnectTestPrisma(adminPrisma);
    });

    it("is a standalone NOLOGIN role that owns no relation or schema", async () => {
      const [role] = await adminPrisma.$queryRaw<
        Array<{
          bypassRls: boolean;
          canCreateDatabase: boolean;
          canCreateRole: boolean;
          canLogin: boolean;
          inheritsRoles: boolean;
          replication: boolean;
          superuser: boolean;
        }>
      >`
        SELECT
          rolcanlogin AS "canLogin",
          rolcreatedb AS "canCreateDatabase",
          rolcreaterole AS "canCreateRole",
          rolsuper AS superuser,
          rolbypassrls AS "bypassRls",
          rolinherit AS "inheritsRoles",
          rolreplication AS replication
        FROM pg_catalog.pg_roles
        WHERE rolname = ${functionOwnerRole}
      `;
      expect(role).toEqual({
        bypassRls: false,
        canCreateDatabase: false,
        canCreateRole: false,
        canLogin: false,
        inheritsRoles: false,
        replication: false,
        superuser: false,
      });

      const memberships = await adminPrisma.$queryRaw<
        Array<{ grantedRole: string; memberRole: string }>
      >`
        SELECT
          parent.rolname AS "grantedRole",
          member.rolname AS "memberRole"
        FROM pg_catalog.pg_auth_members AS membership
        JOIN pg_catalog.pg_roles AS parent
          ON parent.oid = membership.roleid
        JOIN pg_catalog.pg_roles AS member
          ON member.oid = membership.member
        WHERE parent.rolname = ${functionOwnerRole}
          OR member.rolname = ${functionOwnerRole}
        ORDER BY parent.rolname, member.rolname
      `;
      expect(memberships).toEqual([]);

      const ownedRelations = await adminPrisma.$queryRaw<
        Array<{ relation: string }>
      >`
        SELECT pg_catalog.format('%I.%I', namespace.nspname, relation.relname)
          AS relation
        FROM pg_catalog.pg_class AS relation
        JOIN pg_catalog.pg_namespace AS namespace
          ON namespace.oid = relation.relnamespace
        WHERE relation.relowner = (
          SELECT oid
          FROM pg_catalog.pg_roles
          WHERE rolname = ${functionOwnerRole}
        )
        ORDER BY relation
      `;
      expect(ownedRelations).toEqual([]);

      const ownedSchemas = await adminPrisma.$queryRaw<
        Array<{ schemaName: string }>
      >`
        SELECT nspname AS "schemaName"
        FROM pg_catalog.pg_namespace
        WHERE nspowner = (
          SELECT oid
          FROM pg_catalog.pg_roles
          WHERE rolname = ${functionOwnerRole}
        )
        ORDER BY nspname
      `;
      expect(ownedSchemas).toEqual([]);
    });

    it("owns exactly the twelve audited SECURITY DEFINER functions", async () => {
      const functions = await adminPrisma.$queryRaw<
        Array<{
          securityDefiner: boolean;
          settings: string[] | null;
          signature: string;
          volatility: string;
        }>
      >`
        SELECT
          pg_catalog.format(
            '%I.%I(%s)',
            namespace.nspname,
            procedure.proname,
            pg_catalog.pg_get_function_identity_arguments(procedure.oid)
          ) AS signature,
          procedure.prosecdef AS "securityDefiner",
          CASE procedure.provolatile
            WHEN 'v' THEN 'VOLATILE'
            WHEN 's' THEN 'STABLE'
            WHEN 'i' THEN 'IMMUTABLE'
          END AS volatility,
          procedure.proconfig AS settings
        FROM pg_catalog.pg_proc AS procedure
        JOIN pg_catalog.pg_namespace AS namespace
          ON namespace.oid = procedure.pronamespace
        WHERE procedure.proowner = (
          SELECT oid
          FROM pg_catalog.pg_roles
          WHERE rolname = ${functionOwnerRole}
        )
        ORDER BY signature
      `;

      expect(functions).toEqual(expectedFunctions);
    });

    it("has only the audited schema, table, column, and function ACLs", async () => {
      const schemaPrivileges = await adminPrisma.$queryRaw<
        Array<{ isGrantable: boolean; signature: string }>
      >`
        SELECT
          pg_catalog.format(
            '%I:%s',
            namespace.nspname,
            privilege.privilege_type
          ) AS signature,
          privilege.is_grantable AS "isGrantable"
        FROM pg_catalog.pg_namespace AS namespace
        CROSS JOIN LATERAL pg_catalog.aclexplode(namespace.nspacl) AS privilege
        WHERE privilege.grantee = (
          SELECT oid
          FROM pg_catalog.pg_roles
          WHERE rolname = ${functionOwnerRole}
        )
        ORDER BY signature
      `;
      expect(schemaPrivileges).toEqual([
        { isGrantable: false, signature: "public:USAGE" },
      ]);

      const tablePrivileges = await adminPrisma.$queryRaw<
        Array<{ isGrantable: boolean; signature: string }>
      >`
        SELECT
          pg_catalog.format(
            '%s.%s:%s',
            namespace.nspname,
            relation.relname,
            privilege.privilege_type
          ) AS signature,
          privilege.is_grantable AS "isGrantable"
        FROM pg_catalog.pg_class AS relation
        JOIN pg_catalog.pg_namespace AS namespace
          ON namespace.oid = relation.relnamespace
        CROSS JOIN LATERAL pg_catalog.aclexplode(relation.relacl) AS privilege
        WHERE privilege.grantee = (
          SELECT oid
          FROM pg_catalog.pg_roles
          WHERE rolname = ${functionOwnerRole}
        )
        ORDER BY signature
      `;
      expect(tablePrivileges).toEqual(
        expectedTablePrivileges.map((signature) => ({
          isGrantable: false,
          signature,
        })),
      );

      const columnPrivileges = await adminPrisma.$queryRaw<
        Array<{ isGrantable: boolean; signature: string }>
      >`
        SELECT
          pg_catalog.format(
            '%s.%s:%s:%s',
            namespace.nspname,
            relation.relname,
            attribute.attname,
            privilege.privilege_type
          ) AS signature,
          privilege.is_grantable AS "isGrantable"
        FROM pg_catalog.pg_attribute AS attribute
        JOIN pg_catalog.pg_class AS relation
          ON relation.oid = attribute.attrelid
        JOIN pg_catalog.pg_namespace AS namespace
          ON namespace.oid = relation.relnamespace
        CROSS JOIN LATERAL pg_catalog.aclexplode(attribute.attacl) AS privilege
        WHERE privilege.grantee = (
          SELECT oid
          FROM pg_catalog.pg_roles
          WHERE rolname = ${functionOwnerRole}
        )
        ORDER BY signature
      `;
      expect(columnPrivileges).toEqual(
        expectedColumnPrivileges.map((signature) => ({
          isGrantable: false,
          signature,
        })),
      );

      // Function ownership is asserted above. PostgreSQL owner privileges are
      // inherent and deliberately absent from the role's explicit ACL here.
      const functionAclEntries = await adminPrisma.$queryRaw<
        Array<{ isGrantable: boolean; signature: string }>
      >`
        SELECT
          pg_catalog.format(
            '%I.%I(%s):%s',
            namespace.nspname,
            procedure.proname,
            pg_catalog.pg_get_function_identity_arguments(procedure.oid),
            privilege.privilege_type
          ) AS signature,
          privilege.is_grantable AS "isGrantable"
        FROM pg_catalog.pg_proc AS procedure
        JOIN pg_catalog.pg_namespace AS namespace
          ON namespace.oid = procedure.pronamespace
        CROSS JOIN LATERAL pg_catalog.aclexplode(procedure.proacl) AS privilege
        WHERE privilege.grantee = (
          SELECT oid
          FROM pg_catalog.pg_roles
          WHERE rolname = ${functionOwnerRole}
        )
        ORDER BY signature
      `;
      expect(functionAclEntries).toEqual([]);
    });

    it("has no database creation, temporary-table, or sequence privileges", async () => {
      const [databasePrivileges] = await adminPrisma.$queryRaw<
        Array<{
          canConnect: boolean;
          canCreate: boolean;
          canCreateTemporaryTables: boolean;
        }>
      >`
        SELECT
          pg_catalog.has_database_privilege(
            ${functionOwnerRole},
            current_database(),
            'CONNECT'
          ) AS "canConnect",
          pg_catalog.has_database_privilege(
            ${functionOwnerRole},
            current_database(),
            'CREATE'
          ) AS "canCreate",
          pg_catalog.has_database_privilege(
            ${functionOwnerRole},
            current_database(),
            'TEMPORARY'
          ) AS "canCreateTemporaryTables"
      `;
      expect(databasePrivileges).toEqual({
        canConnect: false,
        canCreate: false,
        canCreateTemporaryTables: false,
      });

      const sequencePrivileges = await adminPrisma.$queryRaw<
        Array<{ sequenceName: string }>
      >`
        SELECT pg_catalog.format('%I.%I', namespace.nspname, sequence.relname)
          AS "sequenceName"
        FROM pg_catalog.pg_class AS sequence
        JOIN pg_catalog.pg_namespace AS namespace
          ON namespace.oid = sequence.relnamespace
        WHERE sequence.relkind = 'S'
          AND (
            pg_catalog.has_sequence_privilege(
              ${functionOwnerRole},
              sequence.oid,
              'SELECT'
            )
            OR pg_catalog.has_sequence_privilege(
              ${functionOwnerRole},
              sequence.oid,
              'UPDATE'
            )
            OR pg_catalog.has_sequence_privilege(
              ${functionOwnerRole},
              sequence.oid,
              'USAGE'
            )
          )
        ORDER BY "sequenceName"
      `;
      expect(sequencePrivileges).toEqual([]);
    });

    it("is the sole role on exactly six audited definer-read policies", async () => {
      const policies = await adminPrisma.$queryRaw<
        Array<{
          checkExpression: string | null;
          command: string;
          permissive: string;
          policyName: string;
          roles: string[];
          schemaName: string;
          tableName: string;
          usingExpression: string;
        }>
      >`
        SELECT
          schemaname AS "schemaName",
          tablename AS "tableName",
          policyname AS "policyName",
          permissive,
          roles::text[] AS roles,
          cmd AS command,
          qual AS "usingExpression",
          with_check AS "checkExpression"
        FROM pg_catalog.pg_policies
        WHERE roles::text[] @> ARRAY[${functionOwnerRole}]::text[]
        ORDER BY schemaname, tablename, policyname
      `;

      expect(
        policies.map((policy) => ({
          ...policy,
          usingExpression: policy.usingExpression.replaceAll("::text", ""),
        })),
      ).toEqual([
        {
          checkExpression: null,
          command: "SELECT",
          permissive: "PERMISSIVE",
          policyName: "Comment_hidden_count_reader",
          roles: [functionOwnerRole],
          schemaName: "public",
          tableName: "Comment",
          usingExpression: "true",
        },
        {
          checkExpression: null,
          command: "SELECT",
          permissive: "PERMISSIVE",
          policyName: "CommentReaction_summary_reader",
          roles: [functionOwnerRole],
          schemaName: "public",
          tableName: "CommentReaction",
          usingExpression:
            "(current_setting('app.comment_reaction_summary', true) = 'on')",
        },
        {
          checkExpression: null,
          command: "SELECT",
          permissive: "PERMISSIVE",
          policyName: "HomeworkCompletion_profile_reader",
          roles: [functionOwnerRole],
          schemaName: "public",
          tableName: "HomeworkCompletion",
          usingExpression:
            "(current_setting('app.homework_completion_profile', true) = 'on')",
        },
        {
          checkExpression: null,
          command: "SELECT",
          permissive: "PERMISSIVE",
          policyName: "Upload_definer_read",
          roles: [functionOwnerRole],
          schemaName: "public",
          tableName: "Upload",
          usingExpression: "true",
        },
        {
          checkExpression: "true",
          command: "ALL",
          permissive: "PERMISSIVE",
          policyName: "UploadPending_cleanup_worker",
          roles: [functionOwnerRole],
          schemaName: "public",
          tableName: "UploadPending",
          usingExpression: "true",
        },
        {
          checkExpression: null,
          command: "SELECT",
          permissive: "PERMISSIVE",
          policyName: "UserSectionSubscription_profile_reader",
          roles: [functionOwnerRole],
          schemaName: "public",
          tableName: "UserSectionSubscription",
          usingExpression: "true",
        },
      ]);
    });
  },
);
