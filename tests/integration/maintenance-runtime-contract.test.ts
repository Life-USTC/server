import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupExpiredAuthRecords } from "@/features/auth/server/auth-record-cleanup";
import { createTestPrisma, disconnectTestPrisma } from "../shared/prisma";

const adminPrisma = createTestPrisma(
  process.env.FUNCTION_OWNER_DATABASE_URL ?? process.env.DATABASE_URL,
);
const maintenancePrisma = createTestPrisma(
  process.env.MAINTENANCE_DATABASE_URL ?? process.env.DATABASE_URL,
);
const marker = `maintenance-cleanup-${crypto.randomUUID()}`;

describe.skipIf(process.env.MAINTENANCE_ROLE_TEST_ENABLED !== "true")(
  "maintenance runtime role contract",
  () => {
    let userId: string;

    beforeAll(async () => {
      const now = Date.now();
      const user = await adminPrisma.user.create({
        data: {
          email: `${marker}@example.test`,
          name: marker,
        },
      });
      userId = user.id;

      await adminPrisma.session.createMany({
        data: [
          {
            expires: new Date(now - 60_000),
            sessionToken: `${marker}-expired-session`,
            userId,
          },
          {
            expires: new Date(now + 24 * 60 * 60 * 1000),
            sessionToken: `${marker}-future-session`,
            userId,
          },
        ],
      });
      await adminPrisma.verificationToken.createMany({
        data: [
          {
            expires: new Date(now - 60_000),
            identifier: marker,
            token: `${marker}-expired-token`,
          },
          {
            expires: new Date(now + 24 * 60 * 60 * 1000),
            identifier: marker,
            token: `${marker}-future-token`,
          },
        ],
      });
    });

    afterAll(async () => {
      await adminPrisma.verificationToken.deleteMany({
        where: { identifier: marker },
      });
      await adminPrisma.user.delete({ where: { id: userId } });
      await Promise.all([
        disconnectTestPrisma(adminPrisma),
        disconnectTestPrisma(maintenancePrisma),
      ]);
    });

    it("is an unprivileged standalone login role", async () => {
      const [role] = await maintenancePrisma.$queryRaw<
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
        currentUser: "life_ustc_maintenance_runtime",
        inheritsRoles: false,
        replication: false,
        sessionUser: "life_ustc_maintenance_runtime",
        superuser: false,
      });
    });

    it("has no table grants and only the cleanup function grant", async () => {
      const tableGrants = await maintenancePrisma.$queryRaw<
        Array<{ tableName: string }>
      >`
        SELECT table_name AS "tableName"
        FROM information_schema.role_table_grants
        WHERE grantee = current_user AND table_schema = 'public'
      `;
      expect(tableGrants).toEqual([]);

      const functionGrants = await maintenancePrisma.$queryRaw<
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
            "public.cleanup_expired_auth_records(p_cutoff timestamp without time zone, p_batch_size integer):EXECUTE",
        },
      ]);
    });

    it("rejects future cutoffs and deletes only truly expired records", async () => {
      await expect(
        cleanupExpiredAuthRecords(
          maintenancePrisma,
          new Date(Date.now() + 24 * 60 * 60 * 1000),
        ),
      ).rejects.toThrow("cutoff must not be in the future");

      expect(
        await adminPrisma.session.count({
          where: {
            sessionToken: {
              in: [`${marker}-expired-session`, `${marker}-future-session`],
            },
          },
        }),
      ).toBe(2);
      expect(
        await adminPrisma.verificationToken.count({
          where: { identifier: marker },
        }),
      ).toBe(2);

      const report = await cleanupExpiredAuthRecords(
        maintenancePrisma,
        new Date(),
      );
      expect(report.sessions).toBeGreaterThanOrEqual(1);
      expect(report.verificationTokens).toBeGreaterThanOrEqual(1);
      expect(
        await adminPrisma.session.findUnique({
          where: { sessionToken: `${marker}-expired-session` },
        }),
      ).toBeNull();
      expect(
        await adminPrisma.session.findUnique({
          where: { sessionToken: `${marker}-future-session` },
        }),
      ).not.toBeNull();
      expect(
        await adminPrisma.verificationToken.findUnique({
          where: {
            identifier_token: {
              identifier: marker,
              token: `${marker}-expired-token`,
            },
          },
        }),
      ).toBeNull();
      expect(
        await adminPrisma.verificationToken.findUnique({
          where: {
            identifier_token: {
              identifier: marker,
              token: `${marker}-future-token`,
            },
          },
        }),
      ).not.toBeNull();

      await expect(maintenancePrisma.session.count()).rejects.toThrow();
    });
  },
);
