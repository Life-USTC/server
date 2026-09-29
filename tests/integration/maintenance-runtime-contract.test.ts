import { describe, expect } from "vitest";
import {
  maintainAuditLogRetention,
  maintainOAuthGrantUsageRetention,
} from "@/features/admin/server/audit-retention";
import { cleanupExpiredAuthRecords } from "@/features/auth/server/auth-record-cleanup";
import { isolatedDatabaseTest as it } from "../shared/isolated-database";

describe.skipIf(process.env.MAINTENANCE_ROLE_TEST_ENABLED !== "true")(
  "maintenance runtime role contract",
  () => {
    it("is an unprivileged standalone login role", async ({
      isolatedDatabase: { maintenance: maintenancePrisma },
    }) => {
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

    it("has no table grants and only audited maintenance function grants", async ({
      isolatedDatabase: { maintenance: maintenancePrisma },
    }) => {
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
            "public.claim_upload_pending_storage_cleanup(p_now timestamp without time zone, p_batch_size integer, p_lease_seconds integer):EXECUTE",
        },
        {
          signature:
            "public.cleanup_expired_auth_records(p_cutoff timestamp without time zone, p_batch_size integer):EXECUTE",
        },
        {
          signature:
            "public.finalize_upload_pending_storage_cleanup(p_id text, p_attempt_id text):EXECUTE",
        },
        {
          signature:
            "public.list_section_calendar_subscribers(p_section_id integer, p_after_user_id text, p_batch_size integer):EXECUTE",
        },
        {
          signature:
            "public.list_young_notification_recipients(after_id text, batch_size integer):EXECUTE",
        },
        {
          signature:
            "public.maintain_audit_log_retention(p_now timestamp without time zone, p_batch_size integer):EXECUTE",
        },
        {
          signature:
            "public.maintain_oauth_grant_usage_retention(p_now timestamp without time zone, p_batch_size integer):EXECUTE",
        },
        {
          signature:
            "public.maintain_observability_event_retention(p_now timestamp without time zone, p_batch_size integer):EXECUTE",
        },
        {
          signature:
            "public.release_upload_pending_storage_cleanup(p_id text, p_attempt_id text, p_now timestamp without time zone, p_retry_lease_seconds integer):EXECUTE",
        },
      ]);
    });

    it("rejects future cutoffs and deletes only truly expired records", async ({
      isolatedDatabase: { owner: adminPrisma, maintenance: maintenancePrisma },
    }) => {
      const marker = "auth-cleanup";
      const now = Date.now();
      const user = await adminPrisma.user.create({
        data: {
          email: `${marker}@example.test`,
          name: marker,
        },
      });
      const userId = user.id;

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
      expect(report).toEqual({
        sessions: 1,
        verificationTokens: 1,
        oauthAccessTokens: 0,
        oauthRefreshTokens: 0,
        deviceCodes: 0,
      });
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

    it("anonymizes and expires audit rows without table privileges", async ({
      isolatedDatabase: { owner: adminPrisma, maintenance: maintenancePrisma },
    }) => {
      const marker = "audit-cleanup";
      const now = new Date();
      const ids = {
        network: `${marker}-audit-network`,
        attribution: `${marker}-audit-attribution`,
        expired: `${marker}-audit-expired`,
      };
      await adminPrisma.auditLog.createMany({
        data: [
          {
            id: ids.network,
            action: "account_sign_in",
            createdAt: new Date(now.getTime() - 31 * 86_400_000),
            ipAddress: "192.0.2.1",
            userAgent: "integration-test-agent",
          },
          {
            id: ids.attribution,
            action: "oauth_authorization_update",
            createdAt: new Date(now.getTime() - 91 * 86_400_000),
            oauthGrantId: "grant-secret",
            requestId: "request-secret",
            sessionId: "session-secret",
          },
          {
            id: ids.expired,
            action: "account_sign_out",
            createdAt: new Date(now.getTime() - 401 * 86_400_000),
          },
        ],
      });

      try {
        await expect(
          maintainAuditLogRetention(maintenancePrisma, now),
        ).resolves.toEqual({
          auditRetentionBatches: 1,
          auditRetentionComplete: true,
          attributionAnonymized: 1,
          networkAnonymized: 1,
          rowsDeleted: 1,
        });
        await expect(
          adminPrisma.auditLog.findUnique({ where: { id: ids.network } }),
        ).resolves.toMatchObject({ ipAddress: null, userAgent: null });
        await expect(
          adminPrisma.auditLog.findUnique({ where: { id: ids.attribution } }),
        ).resolves.toMatchObject({
          oauthGrantId: null,
          requestId: null,
          sessionId: null,
        });
        await expect(
          adminPrisma.auditLog.findUnique({ where: { id: ids.expired } }),
        ).resolves.toBeNull();
        await expect(maintenancePrisma.auditLog.count()).rejects.toThrow();
      } finally {
        await adminPrisma.auditLog.deleteMany({
          where: { id: { in: Object.values(ids) } },
        });
      }
    });

    it("empty OAuth retention completes without granting table access", async ({
      isolatedDatabase: { maintenance: maintenancePrisma },
    }) => {
      await expect(
        maintainOAuthGrantUsageRetention(maintenancePrisma, new Date()),
      ).resolves.toEqual({
        oauthRetentionBatches: 1,
        oauthRetentionComplete: true,
        oauthUsageRowsDeleted: 0,
      });
      await expect(
        maintenancePrisma.oAuthGrantUsageDaily.count(),
      ).rejects.toThrow();
    });

    it("retains the inclusive 90-day Shanghai OAuth usage window", async ({
      isolatedDatabase: { owner, maintenance },
    }) => {
      // 00:30 on September 21 in Shanghai; June 24 is the oldest retained day.
      const now = new Date("2026-09-20T16:30:00Z");
      const user = await owner.user.create({
        data: { email: "usage@example.test" },
      });
      const client = await owner.oAuthClient.create({
        data: {
          clientId: "retention-client",
          redirectUris: ["https://example.test/callback"],
        },
      });
      await owner.oAuthGrantUsageDaily.createMany({
        data: ["2026-06-23", "2026-06-24", "2026-06-25"].map((day) => ({
          id: day,
          userId: user.id,
          clientId: client.clientId,
          grantKey: "known-grant",
          day: new Date(day),
          feature: "todos",
          channel: "rest" as const,
          readCount: 2,
          lastUsedAt: now,
        })),
      });
      const retained = await owner.oAuthGrantUsageDaily.findMany({
        where: { id: { in: ["2026-06-24", "2026-06-25"] } },
        orderBy: { id: "asc" },
      });
      expect(await maintainOAuthGrantUsageRetention(maintenance, now)).toEqual({
        oauthRetentionBatches: 1,
        oauthRetentionComplete: true,
        oauthUsageRowsDeleted: 1,
      });
      expect(
        await owner.oAuthGrantUsageDaily.findMany({ orderBy: { id: "asc" } }),
      ).toEqual(retained);
      expect(await maintainOAuthGrantUsageRetention(maintenance, now)).toEqual({
        oauthRetentionBatches: 1,
        oauthRetentionComplete: true,
        oauthUsageRowsDeleted: 0,
      });
      await expect(maintenance.oAuthGrantUsageDaily.count()).rejects.toThrow(
        /permission denied/i,
      );
    });

    it("reports incomplete retention at the batch limit and resumes the remaining rows", async ({
      isolatedDatabase: { owner, maintenance },
    }) => {
      const now = new Date("2026-09-20T12:00:00Z");
      await owner.auditLog.createMany({
        data: Array.from({ length: 1001 }, (_, index) => ({
          id: `bounded-${index}`,
          action: "account_sign_in" as const,
          createdAt: new Date("2026-08-01T12:00:00Z"),
          ipAddress: "192.0.2.1",
        })),
      });
      expect(
        await maintainAuditLogRetention(maintenance, now, { maxBatches: 1 }),
      ).toEqual({
        auditRetentionBatches: 1,
        auditRetentionComplete: false,
        networkAnonymized: 1000,
        attributionAnonymized: 0,
        rowsDeleted: 0,
      });
      expect(
        await owner.auditLog.count({ where: { ipAddress: { not: null } } }),
      ).toBe(1);
      expect(await maintainAuditLogRetention(maintenance, now)).toEqual({
        auditRetentionBatches: 1,
        auditRetentionComplete: true,
        networkAnonymized: 1,
        attributionAnonymized: 0,
        rowsDeleted: 0,
      });
      expect(await owner.auditLog.count({ where: { ipAddress: null } })).toBe(
        1001,
      );
    });

    it("drains more than one audit batch in a single scheduled run", async ({
      isolatedDatabase: { owner: adminPrisma, maintenance: maintenancePrisma },
    }) => {
      const marker = "audit-cleanup";
      const now = new Date();
      const ids = Array.from(
        { length: 1001 },
        (_, index) => `${marker}-multi-batch-${index}`,
      );
      await adminPrisma.auditLog.createMany({
        data: ids.map((id) => ({
          action: "account_sign_in" as const,
          createdAt: new Date(now.getTime() - 31 * 86_400_000),
          id,
          ipAddress: "192.0.2.1",
          userAgent: "multi-batch-test",
        })),
      });

      try {
        await expect(
          maintainAuditLogRetention(maintenancePrisma, now),
        ).resolves.toMatchObject({
          auditRetentionBatches: 2,
          auditRetentionComplete: true,
          networkAnonymized: 1001,
        });
        await expect(
          adminPrisma.auditLog.count({
            where: { id: { in: ids }, ipAddress: null, userAgent: null },
          }),
        ).resolves.toBe(1001);
      } finally {
        await adminPrisma.auditLog.deleteMany({ where: { id: { in: ids } } });
      }
    });
  },
);
