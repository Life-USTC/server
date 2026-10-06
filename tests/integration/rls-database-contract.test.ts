import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { withUserDbContext } from "@/lib/db/prisma";
import { isolatedNodeTest as it } from "../shared/isolated-node-fixture";
import type { TestPrismaClient } from "../shared/prisma";

function loadPrivilegeAllowlist(
  client: TestPrismaClient,
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

const protectedTables = [
  "BusUserPreference",
  "CatalogLinkClick",
  "CommentReaction",
  "HomeworkCompletion",
  "Todo",
  "Upload",
  "UploadPending",
  "UserSectionSubscription",
  "UserUstcIdentity",
  "WorkspaceLinkPin",
] as const;

const expectedRuntimeFunctionPrivileges = [
  "public.claim_upload_pending_storage_cleanup(p_now timestamp without time zone, p_batch_size integer, p_lease_seconds integer):EXECUTE",
  "public.comment_attachment_summaries(p_comment_ids text[]):EXECUTE",
  "public.comment_hidden_root_count(p_section_id integer, p_course_id integer, p_teacher_id integer, p_homework_id text, p_section_teacher_id integer, p_young_event_id integer):EXECUTE",
  "public.comment_reaction_summaries(comment_ids text[]):EXECUTE",
  "public.finalize_upload_pending_storage_cleanup(p_id text, p_attempt_id text):EXECUTE",
  "public.find_downloadable_upload(p_upload_id text):EXECUTE",
  "public.get_public_profile_comment_contribution_days(p_user_id text, p_since timestamp without time zone):EXECUTE",
  "public.get_public_profile_upload_stats(p_user_id text, p_since timestamp without time zone):EXECUTE",
  "public.lock_comment_reply_parent(p_comment_id text):EXECUTE",
  "public.read_prometheus_metrics_snapshot():EXECUTE",
  "public.release_upload_pending_storage_cleanup(p_id text, p_attempt_id text, p_now timestamp without time zone, p_retry_lease_seconds integer):EXECUTE",
] as const;

type RuntimePrivilegeAllowlist = {
  table: string[];
  column: string[];
  sequence: string[];
};

async function loadRuntimePrivilegeAllowlist(
  client: TestPrismaClient,
): Promise<RuntimePrivilegeAllowlist> {
  const [table, column, sequence] = await Promise.all([
    loadPrivilegeAllowlist(
      client,
      "tests/integration/fixtures/app-runtime-table-privileges.sql",
    ),
    loadPrivilegeAllowlist(
      client,
      "tests/integration/fixtures/app-runtime-column-privileges.sql",
    ),
    loadPrivilegeAllowlist(
      client,
      "tests/integration/fixtures/app-runtime-sequence-privileges.sql",
    ),
  ]);
  return { table, column, sequence };
}

async function createScopedFixture(owner: TestPrismaClient) {
  const marker = `rls-database-contract-${crypto.randomUUID()}`;
  const scopedFixture = {
    marker,
    adminUserId: `${marker}-admin`,
    firstUserId: `${marker}-user-a`,
    secondUserId: `${marker}-user-b`,
    clientId: `${marker}-client`,
    auditIds: { first: `${marker}-audit-a`, second: `${marker}-audit-b` },
    usageIds: { first: `${marker}-usage-a`, second: `${marker}-usage-b` },
  };
  await owner.$transaction(async (tx) => {
    await tx.user.createMany({
      data: [
        {
          id: scopedFixture.adminUserId,
          email: `${scopedFixture.adminUserId}@example.invalid`,
          name: `${scopedFixture.marker} admin`,
          isAdmin: true,
        },
        {
          id: scopedFixture.firstUserId,
          email: `${scopedFixture.firstUserId}@example.invalid`,
          name: `${scopedFixture.marker} user A`,
        },
        {
          id: scopedFixture.secondUserId,
          email: `${scopedFixture.secondUserId}@example.invalid`,
          name: `${scopedFixture.marker} user B`,
        },
      ],
    });
    await tx.oAuthClient.create({
      data: {
        clientId: scopedFixture.clientId,
        name: `${scopedFixture.marker} client`,
        redirectUris: ["https://rls-database-contract.example/callback"],
        skipConsent: false,
      },
    });
    await tx.auditLog.createMany({
      data: [
        {
          id: scopedFixture.auditIds.first,
          action: "account_sign_in",
          channel: "web",
          subjectUserId: scopedFixture.firstUserId,
          targetId: scopedFixture.firstUserId,
          targetType: "account",
        },
        {
          id: scopedFixture.auditIds.second,
          action: "account_sign_in",
          channel: "web",
          subjectUserId: scopedFixture.secondUserId,
          targetId: scopedFixture.secondUserId,
          targetType: "account",
        },
      ],
    });
    await tx.oAuthGrantUsageDaily.createMany({
      data: [
        {
          id: scopedFixture.usageIds.first,
          userId: scopedFixture.firstUserId,
          clientId: scopedFixture.clientId,
          grantKey: `${scopedFixture.marker}-grant-a`,
          day: new Date("2026-08-15T00:00:00.000Z"),
          feature: "account.profile",
          channel: "web",
          readCount: 1,
          lastUsedAt: new Date("2026-08-15T10:00:00.000Z"),
        },
        {
          id: scopedFixture.usageIds.second,
          userId: scopedFixture.secondUserId,
          clientId: scopedFixture.clientId,
          grantKey: `${scopedFixture.marker}-grant-b`,
          day: new Date("2026-08-15T00:00:00.000Z"),
          feature: "account.profile",
          channel: "web",
          readCount: 1,
          lastUsedAt: new Date("2026-08-15T10:00:00.000Z"),
        },
      ],
    });
  });
  return scopedFixture;
}
type ScopedFixture = Awaited<ReturnType<typeof createScopedFixture>>;

type ScopedRows = {
  audit: Array<{ id: string; subjectUserId: string | null }>;
  usage: Array<{ id: string; userId: string }>;
};

async function readScopedRows(
  prisma: TestPrismaClient,
  scopedFixture: ScopedFixture,
  userId?: string,
): Promise<ScopedRows> {
  const read = async (client: {
    auditLog: {
      findMany(input: {
        where: { id: { in: string[] } };
        select: { id: true; subjectUserId: true };
        orderBy: { id: "asc" };
      }): Promise<ScopedRows["audit"]>;
    };
    oAuthGrantUsageDaily: {
      findMany(input: {
        where: { id: { in: string[] } };
        select: { id: true; userId: true };
        orderBy: { id: "asc" };
      }): Promise<ScopedRows["usage"]>;
    };
  }): Promise<ScopedRows> => {
    const [audit, usage] = await Promise.all([
      client.auditLog.findMany({
        where: {
          id: {
            in: [scopedFixture.auditIds.first, scopedFixture.auditIds.second],
          },
        },
        select: { id: true, subjectUserId: true },
        orderBy: { id: "asc" },
      }),
      client.oAuthGrantUsageDaily.findMany({
        where: {
          id: {
            in: [scopedFixture.usageIds.first, scopedFixture.usageIds.second],
          },
        },
        select: { id: true, userId: true },
        orderBy: { id: "asc" },
      }),
    ]);
    return { audit, usage };
  };

  if (userId === undefined) return read(prisma);
  // The enclosing nodeRuntime.run binds the production wrapper to this case's
  // app connection and owns its request-local client through workflow completion.
  return withUserDbContext(userId, read);
}

function expectedScopedRows(userId: string, auditId: string, usageId: string) {
  return {
    audit: [{ id: auditId, subjectUserId: userId }],
    usage: [{ id: usageId, userId }],
  };
}

async function assertScopedReadContract(
  prisma: TestPrismaClient,
  scopedFixture: ScopedFixture,
) {
  await expect(
    readScopedRows(prisma, scopedFixture, scopedFixture.firstUserId),
  ).resolves.toEqual(
    expectedScopedRows(
      scopedFixture.firstUserId,
      scopedFixture.auditIds.first,
      scopedFixture.usageIds.first,
    ),
  );
  await expect(
    readScopedRows(prisma, scopedFixture, scopedFixture.secondUserId),
  ).resolves.toEqual(
    expectedScopedRows(
      scopedFixture.secondUserId,
      scopedFixture.auditIds.second,
      scopedFixture.usageIds.second,
    ),
  );
  await expect(readScopedRows(prisma, scopedFixture)).resolves.toEqual({
    audit: [],
    usage: [],
  });
}

// Native gates remain outside fixture acquisition. Each case owns its database;
// the runtime drains its entire callback before those clients are disconnected.
describe.skipIf(process.env.RLS_TEST_ENABLED !== "true")(
  "PostgreSQL row security contract",
  () => {
    it("uses an unprivileged runtime role that owns none of the protected tables", async ({
      isolatedDatabase: { app: prisma },
      nodeRuntime,
    }) => {
      await nodeRuntime.run(async () => {
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
    });

    it("allows the app runtime to append trusted profile picture URLs", async ({
      isolatedDatabase: { app: prisma, owner: adminPrisma },
      nodeRuntime,
    }) => {
      await nodeRuntime.run(async () => {
        const marker = `runtime-avatar-${crypto.randomUUID()}`;
        const user = await adminPrisma.user.create({
          data: {
            email: `${marker}@example.test`,
            name: marker,
          },
          select: { id: true },
        });

        await expect(
          prisma.user.update({
            where: { id: user.id },
            data: {
              profilePictures: {
                push: `https://example.test/${marker}.webp`,
              },
            },
            select: { profilePictures: true },
          }),
        ).resolves.toEqual({
          profilePictures: [`https://example.test/${marker}.webp`],
        });
      });
    });

    it("enforces scoped reads for audit and OAuth usage tables", async ({
      isolatedDatabase: { app: prisma, owner: adminPrisma },
      nodeRuntime,
    }) => {
      await nodeRuntime.run(async () => {
        const scopedFixture = await createScopedFixture(adminPrisma);
        const tables = await adminPrisma.$queryRaw<
          Array<{ rlsEnabled: boolean; tableName: string }>
        >(Prisma.sql`
            SELECT relname AS "tableName", relrowsecurity AS "rlsEnabled"
            FROM pg_class
            JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
            WHERE nspname = 'public'
              AND relname IN ('AuditLog', 'OAuthGrantUsageDaily')
            ORDER BY relname
          `);
        expect(tables).toEqual([
          { rlsEnabled: true, tableName: "AuditLog" },
          { rlsEnabled: true, tableName: "OAuthGrantUsageDaily" },
        ]);

        await assertScopedReadContract(prisma, scopedFixture);
        await expect(
          readScopedRows(prisma, scopedFixture, scopedFixture.adminUserId),
        ).resolves.toEqual({
          audit: [
            {
              id: scopedFixture.auditIds.first,
              subjectUserId: scopedFixture.firstUserId,
            },
            {
              id: scopedFixture.auditIds.second,
              subjectUserId: scopedFixture.secondUserId,
            },
          ],
          usage: [
            {
              id: scopedFixture.usageIds.first,
              userId: scopedFixture.firstUserId,
            },
            {
              id: scopedFixture.usageIds.second,
              userId: scopedFixture.secondUserId,
            },
          ],
        });
      });
    });

    it("keeps exactly one runtime-applicable owner policy per table", async ({
      isolatedDatabase: { app: prisma },
      nodeRuntime,
    }) => {
      await nodeRuntime.run(async () => {
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
    });

    it("treats an empty transaction-local user context as missing", async ({
      isolatedDatabase: { app: prisma, owner: adminPrisma },
      nodeRuntime,
    }) => {
      await nodeRuntime.run(async () => {
        const emptyOwnerTodoId = "rls-empty-owner-todo";
        // The empty primary key is the security probe, confined to this private DB.
        await adminPrisma.$transaction(async (tx) => {
          await tx.user.create({
            data: {
              id: "",
              email: "rls-empty-owner@example.invalid",
              name: "RLS empty owner probe",
            },
          });
          await tx.todo.create({
            data: {
              id: emptyOwnerTodoId,
              title: "RLS empty owner probe",
              userId: "",
            },
          });
        });

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
      });
    });

    it("keeps runtime grants on the checked-in privilege contract", async ({
      isolatedDatabase: { app: prisma, connections },
      nodeRuntime,
    }) => {
      await nodeRuntime.run(async () => {
        const expectedRuntimePrivileges =
          await loadRuntimePrivilegeAllowlist(prisma);

        // Exercise the production verifier against the same explicit contract.
        execFileSync(
          "psql",
          [
            connections.app,
            "-X",
            "--quiet",
            "--set=expected_role=life_ustc_runtime",
            "--set=expected_schema_privileges=public:USAGE",
            `--set=expected_table_privileges=${expectedRuntimePrivileges.table.join(",")}`,
            `--set=expected_column_privileges=${expectedRuntimePrivileges.column.join(",")}`,
            `--set=expected_sequence_privileges=${expectedRuntimePrivileges.sequence.join(",")}`,
            `--set=expected_function_privileges=${expectedRuntimeFunctionPrivileges.join(",")}`,
            "--file=prisma/roles/verify-app-runtime.sql",
          ],
          { stdio: "pipe" },
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
        ).toEqual(expectedRuntimePrivileges.table);

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
        ).toEqual(expectedRuntimePrivileges.table);

        const columnGrants = await prisma.$queryRaw<
          { tableName: string; columnName: string; privilege: string }[]
        >(Prisma.sql`
            SELECT
              relation.relname AS "tableName",
              attribute.attname AS "columnName",
              acl.privilege_type AS privilege
            FROM pg_class AS relation
            JOIN pg_namespace AS namespace
              ON namespace.oid = relation.relnamespace
            JOIN pg_attribute AS attribute
              ON attribute.attrelid = relation.oid
              AND attribute.attnum > 0
              AND NOT attribute.attisdropped
            CROSS JOIN LATERAL aclexplode(attribute.attacl) AS acl
            WHERE namespace.nspname = 'public'
              AND acl.grantee = (
                SELECT oid FROM pg_roles WHERE rolname = current_user
              )
            ORDER BY namespace.nspname, relation.relname, attribute.attname,
              acl.privilege_type
          `);
        expect(
          columnGrants.map(
            ({ tableName, columnName, privilege }) =>
              `public.${tableName}.${columnName}:${privilege}`,
          ),
        ).toEqual(expectedRuntimePrivileges.column);

        const sequenceGrants = await prisma.$queryRaw<
          { sequenceName: string; privilege: string }[]
        >(Prisma.sql`
            SELECT
              relation.relname AS "sequenceName",
              acl.privilege_type AS privilege
            FROM pg_class AS relation
            JOIN pg_namespace AS namespace
              ON namespace.oid = relation.relnamespace
            CROSS JOIN LATERAL aclexplode(COALESCE(
              relation.relacl,
              acldefault('S', relation.relowner)
            )) AS acl
            WHERE namespace.nspname = 'public'
              AND relation.relkind = 'S'
              AND acl.grantee = (
                SELECT oid FROM pg_roles WHERE rolname = current_user
              )
            ORDER BY namespace.nspname, relation.relname, acl.privilege_type
          `);
        expect(
          sequenceGrants.map(
            ({ sequenceName, privilege }) =>
              `public.${sequenceName}:${privilege}`,
          ),
        ).toEqual(expectedRuntimePrivileges.sequence);

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
    });

    it("has no role memberships in either direction", async ({
      isolatedDatabase: { app: prisma },
      nodeRuntime,
    }) => {
      await nodeRuntime.run(async () => {
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
    });

    it("cannot access authentication-owned tables", async ({
      isolatedDatabase: { app: prisma },
      nodeRuntime,
    }) => {
      await nodeRuntime.run(async () => {
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
    });
  },
);
