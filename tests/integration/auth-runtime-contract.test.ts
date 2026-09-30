import { describe } from "vitest";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { recordOAuthGrantUsage } from "@/lib/oauth/grant-usage";
import { nodeProtocolTest } from "../shared/node-protocol-fixture";
import { createTestPrisma, type TestPrismaClient } from "../shared/prisma";

type RoleClients = {
  authPrisma: TestPrismaClient;
  adminPrisma: TestPrismaClient;
};
type Records = {
  marker: string;
  userId: string;
  auditId: string;
  clientId: string;
  grantId: string;
  adminInsertId: string;
  picturesInsertId: string;
};
const it = nodeProtocolTest.extend<{
  roleClients: RoleClients;
  records: Records;
}>({
  roleClients: async (
    { isolatedDatabase, protocolRuntime, onTestFinished },
    use,
  ) => {
    // Auth may read only the audited User columns, so its dedicated client must
    // omit calendarFeedToken even though the owner observer can read that field.
    const authPrisma = createTestPrisma(isolatedDatabase.connections.auth, {
      user: { calendarFeedToken: true },
    });
    try {
      await use({ authPrisma, adminPrisma: isolatedDatabase.owner });
    } finally {
      // Keep this client until every admitted role operation finishes. The
      // enclosing runtime reports its own original cached cleanup error.
      await Promise.allSettled([protocolRuntime.close()]);
      try {
        await authPrisma.$disconnect();
      } catch (error) {
        onTestFinished(() => {
          throw error;
        });
      }
    }
  },
  // biome-ignore lint/correctness/noEmptyPattern: Vitest requires destructured fixture dependencies.
  records: async ({}, use) => {
    const marker = `auth-role-${crypto.randomUUID()}`;
    await use({
      marker,
      userId: `${marker}-user`,
      auditId: `${marker}-audit`,
      clientId: `${marker}-client`,
      grantId: `${marker}-grant`,
      adminInsertId: `${marker}-admin-insert`,
      picturesInsertId: `${marker}-pictures-insert`,
    });
  },
});

const expectedTablePrivileges = [
  "Account:DELETE",
  "Account:INSERT",
  "Account:SELECT",
  "Account:UPDATE",
  "AuditLog:INSERT",
  "DeviceCode:DELETE",
  "DeviceCode:INSERT",
  "DeviceCode:SELECT",
  "DeviceCode:UPDATE",
  "Jwks:INSERT",
  "Jwks:SELECT",
  "OAuthAccessToken:DELETE",
  "OAuthAccessToken:INSERT",
  "OAuthAccessToken:SELECT",
  "OAuthAccessToken:UPDATE",
  "OAuthClient:DELETE",
  "OAuthClient:INSERT",
  "OAuthClient:SELECT",
  "OAuthClient:UPDATE",
  "OAuthConsent:DELETE",
  "OAuthConsent:INSERT",
  "OAuthConsent:SELECT",
  "OAuthConsent:UPDATE",
  "OAuthGrantUsageDaily:DELETE",
  "OAuthGrantUsageDaily:INSERT",
  "OAuthGrantUsageDaily:SELECT",
  "OAuthGrantUsageDaily:UPDATE",
  "OAuthRefreshToken:DELETE",
  "OAuthRefreshToken:INSERT",
  "OAuthRefreshToken:SELECT",
  "OAuthRefreshToken:UPDATE",
  "Passkey:DELETE",
  "Passkey:INSERT",
  "Passkey:SELECT",
  "Passkey:UPDATE",
  "Session:DELETE",
  "Session:INSERT",
  "Session:SELECT",
  "Session:UPDATE",
  "VerificationToken:DELETE",
  "VerificationToken:INSERT",
  "VerificationToken:SELECT",
  "VerificationToken:UPDATE",
  "VerifiedEmail:DELETE",
  "VerifiedEmail:INSERT",
  "VerifiedEmail:SELECT",
  "VerifiedEmail:UPDATE",
  "oauthClientAssertion:DELETE",
  "oauthClientAssertion:INSERT",
  "oauthClientAssertion:SELECT",
  "oauthClientAssertion:UPDATE",
  "oauthClientResource:DELETE",
  "oauthClientResource:INSERT",
  "oauthClientResource:SELECT",
  "oauthClientResource:UPDATE",
  "oauthResource:DELETE",
  "oauthResource:INSERT",
  "oauthResource:SELECT",
  "oauthResource:UPDATE",
] as const;

const expectedColumnPrivileges = [
  "User:createdAt:INSERT",
  "User:createdAt:SELECT",
  "User:email:INSERT",
  "User:email:SELECT",
  "User:email:UPDATE",
  "User:emailVerified:INSERT",
  "User:emailVerified:SELECT",
  "User:emailVerified:UPDATE",
  "User:id:INSERT",
  "User:id:SELECT",
  "User:image:INSERT",
  "User:image:SELECT",
  "User:image:UPDATE",
  "User:isAdmin:SELECT",
  "User:name:INSERT",
  "User:name:SELECT",
  "User:name:UPDATE",
  "User:profilePictures:SELECT",
  "User:updatedAt:INSERT",
  "User:updatedAt:SELECT",
  "User:updatedAt:UPDATE",
  "User:username:SELECT",
  "User:username:UPDATE",
] as const;

describe.skipIf(process.env.AUTH_ROLE_TEST_ENABLED !== "true")(
  "authentication runtime role contract",
  () => {
    it("is an unprivileged standalone login role", async ({
      roleClients: { authPrisma },
      protocolRuntime,
      expect,
    }) => {
      await protocolRuntime.run(async () => {
        const [role] = await authPrisma.$queryRaw<
          Array<{
            bypassRls: boolean;
            canCreateDatabase: boolean;
            canCreateRole: boolean;
            canLogin: boolean;
            currentUser: string;
            inheritsRoles: boolean;
            replication: boolean;
            sessionUser: string;
            superuser: boolean;
          }>
        >`
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
        FROM pg_catalog.pg_roles
        WHERE rolname = current_user
      `;

        expect(role).toEqual({
          bypassRls: false,
          canCreateDatabase: false,
          canCreateRole: false,
          canLogin: true,
          currentUser: "life_ustc_auth_runtime",
          inheritsRoles: false,
          replication: false,
          sessionUser: "life_ustc_auth_runtime",
          superuser: false,
        });
      });
    });

    it("has only the audited auth table and unlink-function grants", async ({
      roleClients: { authPrisma },
      protocolRuntime,
      expect,
    }) => {
      await protocolRuntime.run(async () => {
        const tableGrants = await authPrisma.$queryRaw<
          Array<{ privilege: string; tableName: string }>
        >`
        SELECT
          table_name AS "tableName",
          privilege_type AS privilege
        FROM information_schema.role_table_grants
        WHERE grantee = current_user AND table_schema = 'public'
        ORDER BY table_name, privilege_type
      `;
        expect(
          tableGrants.map(
            ({ privilege, tableName }) => `${tableName}:${privilege}`,
          ),
        ).toEqual(expectedTablePrivileges);

        const columnGrants = await authPrisma.$queryRaw<
          Array<{ columnName: string; privilege: string; tableName: string }>
        >`
        SELECT
          relation.relname AS "tableName",
          attribute.attname AS "columnName",
          privilege.privilege_type AS privilege
        FROM pg_catalog.pg_class AS relation
        JOIN pg_catalog.pg_namespace AS namespace
          ON namespace.oid = relation.relnamespace
        JOIN pg_catalog.pg_attribute AS attribute
          ON attribute.attrelid = relation.oid
        CROSS JOIN LATERAL pg_catalog.aclexplode(attribute.attacl) AS privilege
        WHERE namespace.nspname = 'public'
          AND attribute.attnum > 0
          AND NOT attribute.attisdropped
          AND privilege.grantee = (
            SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user
          )
        ORDER BY relation.relname, attribute.attname, privilege.privilege_type
      `;
        expect(
          columnGrants.map(
            ({ columnName, privilege, tableName }) =>
              `${tableName}:${columnName}:${privilege}`,
          ),
        ).toEqual(expectedColumnPrivileges);

        const functionGrants = await authPrisma.$queryRaw<
          Array<{ signature: string }>
        >`
        SELECT pg_catalog.format(
          '%s.%s(%s):EXECUTE',
          namespace.nspname,
          procedure.proname,
          pg_catalog.pg_get_function_identity_arguments(procedure.oid)
        ) AS signature
        FROM pg_catalog.pg_proc AS procedure
        JOIN pg_catalog.pg_namespace AS namespace
          ON namespace.oid = procedure.pronamespace
        JOIN LATERAL pg_catalog.aclexplode(procedure.proacl) AS privilege
          ON privilege.grantee = (
            SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user
          )
        WHERE namespace.nspname = 'public'
          AND privilege.privilege_type = 'EXECUTE'
        ORDER BY signature
      `;
        expect(functionGrants).toEqual([
          {
            signature:
              'public.delete_own_account(p_user_id text, p_audit_id text, p_channel "AuditChannel", p_ip_address text, p_user_agent text, p_session_id text, p_request_id text):EXECUTE',
          },
          {
            signature:
              "public.remove_sign_in_method(p_user_id text, p_kind text, p_key text, p_enabled_providers jsonb):EXECUTE",
          },
        ]);
      });
    });

    it("can append audit records but cannot read or mutate them", async ({
      roleClients: { authPrisma, adminPrisma },
      records: { marker, userId, auditId },
      protocolRuntime,
      expect,
    }) => {
      await protocolRuntime.run(async () => {
        const user = await authPrisma.user.create({
          data: { id: userId, email: `${marker}@example.test`, name: marker },
          select: { id: true },
        });
        await expect(
          authPrisma.account.create({
            data: {
              issuer: "https://issuer.example.test",
              provider: "test",
              providerAccountId: marker,
              userId: user.id,
            },
          }),
        ).resolves.toMatchObject({ userId: user.id });
        await writeAuditLog(
          {
            action: "account_sign_in",
            channel: "auth",
            id: auditId,
            subjectUserId: user.id,
            userId: user.id,
          },
          authPrisma,
        );
        await expect(
          adminPrisma.auditLog.findUnique({ where: { id: auditId } }),
        ).resolves.toMatchObject({
          action: "account_sign_in",
          channel: "auth",
          id: auditId,
          subjectUserId: user.id,
          userId: user.id,
        });
        await expect(authPrisma.todo.count()).rejects.toThrow();
        await expect(authPrisma.auditLog.count()).rejects.toThrow(
          "permission denied for table AuditLog",
        );
        await expect(
          authPrisma.auditLog.updateMany({
            where: { id: auditId },
            data: { outcome: "failure" },
          }),
        ).rejects.toThrow("permission denied for table AuditLog");
        await expect(
          authPrisma.auditLog.deleteMany({ where: { id: auditId } }),
        ).rejects.toThrow("permission denied for table AuditLog");
      });
    });

    it("can atomically manage OAuth usage while retaining no app-table access", async ({
      roleClients: { authPrisma },
      records: { marker, userId, clientId, grantId },
      protocolRuntime,
      expect,
    }) => {
      await protocolRuntime.run(async () => {
        const user = await authPrisma.user.create({
          data: { id: userId, email: `${marker}@example.test`, name: marker },
          select: { id: true },
        });
        await authPrisma.oAuthClient.create({
          data: {
            clientId,
            name: marker,
            redirectUris: ["https://client.example.test/callback"],
          },
        });
        await recordOAuthGrantUsage(
          {
            userId: user.id,
            clientId,
            grantId,
            channel: "rest",
            feature: "account.profile",
            action: "read",
          },
          authPrisma,
        );
        await expect(
          authPrisma.oAuthGrantUsageDaily.findFirstOrThrow({
            where: { userId: user.id, clientId, grantId },
          }),
        ).resolves.toMatchObject({ readCount: 1 });
        await expect(
          authPrisma.oAuthGrantUsageDaily.deleteMany({
            where: { userId: user.id, clientId, grantId },
          }),
        ).resolves.toMatchObject({ count: 1 });
        await expect(authPrisma.auditLog.count()).rejects.toThrow();
      });
    });

    it("can update profile columns but not application-owned User fields", async ({
      roleClients: { authPrisma },
      records: { marker, userId, adminInsertId, picturesInsertId },
      protocolRuntime,
      expect,
    }) => {
      await protocolRuntime.run(async () => {
        const user = await authPrisma.user.create({
          data: { id: userId, email: `${marker}@example.test`, name: marker },
          select: { id: true },
        });
        await expect(
          authPrisma.user.create({
            data: {
              id: adminInsertId,
              email: `${marker}-admin-insert@example.test`,
              isAdmin: true,
              name: marker,
            },
            select: { id: true },
          }),
        ).rejects.toThrow("permission denied for table User");
        await expect(
          authPrisma.user.create({
            data: {
              id: picturesInsertId,
              email: `${marker}-pictures-insert@example.test`,
              name: marker,
              profilePictures: ["https://attacker.example/avatar.svg"],
            },
            select: { id: true },
          }),
        ).rejects.toThrow("permission denied for table User");

        await expect(
          authPrisma.user.update({
            where: { id: user.id },
            data: {
              emailVerified: true,
              image: "https://example.test/auth-runtime-avatar.svg",
              name: `${marker}-updated`,
              username: marker,
            },
            select: {
              emailVerified: true,
              image: true,
              isAdmin: true,
              name: true,
              username: true,
            },
          }),
        ).resolves.toMatchObject({
          emailVerified: true,
          image: "https://example.test/auth-runtime-avatar.svg",
          isAdmin: false,
          name: `${marker}-updated`,
          username: marker,
        });

        await expect(
          authPrisma.user.update({
            where: { id: user.id },
            data: { isAdmin: true },
          }),
        ).rejects.toThrow("permission denied for table User");
        await expect(
          authPrisma.user.update({
            where: { id: user.id },
            data: {
              profilePictures: {
                set: ["https://attacker.example/avatar.svg"],
              },
            },
          }),
        ).rejects.toThrow("permission denied for table User");
        await expect(
          authPrisma.user.update({
            where: { id: user.id },
            data: { calendarFeedToken: marker },
          }),
        ).rejects.toThrow("permission denied for table User");

        await expect(
          authPrisma.$queryRaw`
            SELECT "calendarFeedToken"
            FROM "User"
            WHERE id = ${user.id}
          `,
        ).rejects.toThrow("permission denied for table User");
        await expect(
          authPrisma.user.findUniqueOrThrow({
            where: { id: user.id },
            select: { isAdmin: true, profilePictures: true },
          }),
        ).resolves.toEqual({
          isAdmin: false,
          profilePictures: [],
        });
      });
    });
  },
);
