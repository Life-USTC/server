import { afterAll, expect, it } from "vitest";
import { maintainAuditLogRetention } from "@/features/admin/server/audit-retention";
import { createFixturePrisma, createTestPrisma } from "../shared/prisma";
import { auditRetentionExpectation } from "../shared/specifications/audit";

const owner = createFixturePrisma();
const app = createTestPrisma();
const auth = createTestPrisma(process.env.AUTH_DATABASE_URL);
const maintenance = createTestPrisma(process.env.MAINTENANCE_DATABASE_URL);
const marker = `audit-policy-${crypto.randomUUID()}`;
afterAll(async () => {
  await owner.auditLog.deleteMany({ where: { id: { startsWith: marker } } });
  await Promise.all(
    [owner, app, auth, maintenance].map((db) => db.$disconnect()),
  );
});

it("audit.writer-4", async () => {
  const expected = auditRetentionExpectation();
  const now = new Date(Date.now() - 1000);
  const privateFields = {
    ipAddress: "192.0.2.4",
    userAgent: "private browser",
    oauthGrantId: "private grant",
    sessionId: "private session",
    requestId: "private request",
  };
  for (const [kind, days] of Object.entries({
    network: expected.network_days,
    attribution: expected.attribution_days,
    event: expected.event_days,
  })) {
    for (const offset of [-1, 0, 1]) {
      await owner.auditLog.create({
        data: {
          id: `${marker}-${kind}-${offset}`,
          action: "account_sign_in",
          outcome: "success",
          metadata: { source: "audit-policy-test" },
          createdAt: new Date(now.getTime() - days * 86_400_000 + offset),
          ...privateFields,
        },
      });
    }
  }
  expect(expected.boundary).toBe("inclusive");
  expect(expected.operation).toBe("maintain_audit_log_retention");
  expect(await maintainAuditLogRetention(maintenance, now)).toMatchObject({
    auditRetentionComplete: true,
  });
  for (const [kind, days] of Object.entries({
    network: expected.network_days,
    attribution: expected.attribution_days,
    event: expected.event_days,
  })) {
    for (const offset of [-1, 0, 1]) {
      const row = await owner.auditLog.findUnique({
        where: { id: `${marker}-${kind}-${offset}` },
      });
      const age = days * 86_400_000 - offset;
      if (age >= expected.event_days * 86_400_000) {
        expect(row).toBeNull();
        continue;
      }
      expect(row).not.toBeNull();
      const networkExpired = age >= expected.network_days * 86_400_000;
      const attributionExpired = age >= expected.attribution_days * 86_400_000;
      expect(row).toMatchObject({
        action: "account_sign_in",
        outcome: "success",
        metadata: { source: "audit-policy-test" },
        ipAddress: networkExpired ? null : privateFields.ipAddress,
        userAgent: networkExpired ? null : privateFields.userAgent,
        oauthGrantId: attributionExpired ? null : privateFields.oauthGrantId,
        sessionId: attributionExpired ? null : privateFields.sessionId,
        requestId: attributionExpired ? null : privateFields.requestId,
      });
    }
  }
});

it("audit.retention-maintenance-authority", async () => {
  const [definition] = await owner.$queryRaw<
    Array<{ securityDefiner: boolean; owner: string }>
  >`
    SELECT p.prosecdef AS "securityDefiner", r.rolname AS owner
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_catalog.pg_roles r ON r.oid = p.proowner
    WHERE n.nspname = 'public' AND p.proname = 'maintain_audit_log_retention'
  `;
  expect(definition).toEqual({
    securityDefiner: true,
    owner: "life_ustc_function_owner",
  });
  const now = new Date(Date.now() - 1000);
  for (const role of [app, auth]) {
    await expect(maintainAuditLogRetention(role, now)).rejects.toThrow(
      /permission denied/i,
    );
    await expect(
      role.auditLog.deleteMany({ where: { id: `${marker}-nonexistent` } }),
    ).rejects.toThrow(/permission denied/i);
  }
  await expect(
    maintainAuditLogRetention(maintenance, now),
  ).resolves.toMatchObject({ auditRetentionComplete: true });
  await expect(
    maintenance.auditLog.deleteMany({ where: { id: `${marker}-nonexistent` } }),
  ).rejects.toThrow(/permission denied/i);
});
