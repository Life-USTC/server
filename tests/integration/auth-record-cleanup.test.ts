import {
  AUTH_RECORD_CLEANUP_BATCH_SIZE,
  type AuthRecordCleanupReport,
  cleanupExpiredAuthRecords,
} from "@/features/auth/server/auth-record-cleanup";
import { createTestPrisma, disconnectTestPrisma } from "../shared/prisma";

const prisma = createTestPrisma();
const cutoff = new Date(Date.now() - 60_000);
const expiredAt = new Date(cutoff.getTime() - 60_000);
const futureAt = new Date(cutoff.getTime() + 24 * 60 * 60 * 1000);
const marker = `auth-cleanup-${crypto.randomUUID()}`;

describe("expired auth record cleanup", () => {
  let userId: string;
  let clientId: string;
  let preexistingExpired: AuthRecordCleanupReport;

  beforeAll(async () => {
    const [
      sessions,
      verificationTokens,
      oauthAccessTokens,
      oauthRefreshTokens,
      deviceCodes,
    ] = await Promise.all([
      prisma.session.count({ where: { expires: { lt: cutoff } } }),
      prisma.verificationToken.count({ where: { expires: { lt: cutoff } } }),
      prisma.oAuthAccessToken.count({
        where: { expiresAt: { lt: cutoff } },
      }),
      prisma.oAuthRefreshToken.count({
        where: { expiresAt: { lt: cutoff } },
      }),
      prisma.deviceCode.count({ where: { expiresAt: { lt: cutoff } } }),
    ]);
    preexistingExpired = {
      sessions,
      verificationTokens,
      oauthAccessTokens,
      oauthRefreshTokens,
      deviceCodes,
    };

    const user = await prisma.user.create({
      data: {
        email: `${marker}@example.test`,
        name: marker,
      },
    });
    userId = user.id;

    const client = await prisma.oAuthClient.create({
      data: {
        clientId: marker,
        name: marker,
        redirectUris: [],
        userId,
      },
    });
    clientId = client.clientId;

    await prisma.session.createMany({
      data: Array.from(
        { length: AUTH_RECORD_CLEANUP_BATCH_SIZE + 1 },
        (_, index) => ({
          sessionToken: `${marker}-expired-session-${index}`,
          userId,
          expires: expiredAt,
        }),
      ),
    });
    await prisma.session.createMany({
      data: [
        {
          sessionToken: `${marker}-boundary-session`,
          userId,
          expires: cutoff,
        },
        {
          sessionToken: `${marker}-future-session`,
          userId,
          expires: futureAt,
        },
      ],
    });
    await prisma.verificationToken.createMany({
      data: [
        ...Array.from(
          { length: AUTH_RECORD_CLEANUP_BATCH_SIZE + 1 },
          (_, index) => ({
            identifier: marker,
            token: `${marker}-expired-verification-${index}`,
            expires: expiredAt,
          }),
        ),
        {
          identifier: marker,
          token: `${marker}-boundary-verification`,
          expires: cutoff,
        },
      ],
    });
    await prisma.deviceCode.createMany({
      data: [
        ...Array.from(
          { length: AUTH_RECORD_CLEANUP_BATCH_SIZE + 1 },
          (_, index) => ({
            deviceCode: `${marker}-expired-device-${index}`,
            userCode: `${marker}-expired-user-code-${index}`,
            clientId,
            userId,
            expiresAt: expiredAt,
          }),
        ),
        {
          deviceCode: `${marker}-boundary-device`,
          userCode: `${marker}-boundary-user-code`,
          clientId,
          userId,
          expiresAt: cutoff,
        },
      ],
    });
    await prisma.oAuthRefreshToken.createMany({
      data: [
        ...Array.from(
          { length: AUTH_RECORD_CLEANUP_BATCH_SIZE + 1 },
          (_, index) => ({
            token: `${marker}-expired-refresh-${index}`,
            clientId,
            userId,
            expiresAt: expiredAt,
          }),
        ),
        {
          token: `${marker}-boundary-refresh`,
          clientId,
          userId,
          expiresAt: cutoff,
        },
        {
          token: `${marker}-revoked-future-refresh`,
          clientId,
          userId,
          expiresAt: futureAt,
          revoked: expiredAt,
        },
      ],
    });
    await prisma.oAuthAccessToken.createMany({
      data: [
        ...Array.from(
          { length: AUTH_RECORD_CLEANUP_BATCH_SIZE + 1 },
          (_, index) => ({
            token: `${marker}-expired-access-${index}`,
            clientId,
            userId,
            expiresAt: expiredAt,
          }),
        ),
        {
          token: `${marker}-boundary-access`,
          clientId,
          userId,
          expiresAt: cutoff,
        },
        {
          token: `${marker}-future-access`,
          clientId,
          userId,
          expiresAt: futureAt,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.verificationToken.deleteMany({
      where: { identifier: marker },
    });
    await prisma.user.delete({ where: { id: userId } });
    await disconnectTestPrisma(prisma);
  });

  test("uses a locked-down security-definer function with bounded batches", async () => {
    const [definition] = await prisma.$queryRaw<
      Array<{
        securityDefiner: boolean;
        settings: string[] | null;
        publicCanExecute: boolean;
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
        'public.cleanup_expired_auth_records(timestamp without time zone,integer)'
      )
    `;

    expect(definition).toEqual({
      securityDefiner: true,
      settings: ['search_path=""'],
      publicCanExecute: false,
    });

    for (const batchSize of [0, AUTH_RECORD_CLEANUP_BATCH_SIZE + 1]) {
      await expect(
        prisma.$queryRaw`
          SELECT *
          FROM public.cleanup_expired_auth_records(${cutoff}, ${batchSize})
        `,
      ).rejects.toThrow("batch size must be between 1 and 1000");
    }
  });

  test("rejects a future cutoff before deleting expired or future records", async () => {
    await expect(
      cleanupExpiredAuthRecords(
        prisma,
        new Date(Date.now() + 24 * 60 * 60 * 1000),
      ),
    ).rejects.toThrow("cutoff must not be in the future");

    expect(
      await prisma.session.count({
        where: {
          sessionToken: {
            in: [`${marker}-expired-session-0`, `${marker}-future-session`],
          },
        },
      }),
    ).toBe(2);
    expect(
      await prisma.oAuthAccessToken.count({
        where: {
          token: {
            in: [`${marker}-expired-access-0`, `${marker}-future-access`],
          },
        },
      }),
    ).toBe(2);
  });

  test("runs concurrently in bounded, idempotent batches while preserving boundary and replay-detection rows", async () => {
    const reports = await Promise.all([
      cleanupExpiredAuthRecords(prisma, cutoff),
      cleanupExpiredAuthRecords(prisma, cutoff),
    ]);
    const total = reports.reduce<AuthRecordCleanupReport>(
      (sum, report) => ({
        sessions: sum.sessions + report.sessions,
        verificationTokens: sum.verificationTokens + report.verificationTokens,
        oauthAccessTokens: sum.oauthAccessTokens + report.oauthAccessTokens,
        oauthRefreshTokens: sum.oauthRefreshTokens + report.oauthRefreshTokens,
        deviceCodes: sum.deviceCodes + report.deviceCodes,
      }),
      {
        sessions: 0,
        verificationTokens: 0,
        oauthAccessTokens: 0,
        oauthRefreshTokens: 0,
        deviceCodes: 0,
      },
    );

    expect(total).toEqual({
      sessions:
        AUTH_RECORD_CLEANUP_BATCH_SIZE + 1 + preexistingExpired.sessions,
      verificationTokens:
        AUTH_RECORD_CLEANUP_BATCH_SIZE +
        1 +
        preexistingExpired.verificationTokens,
      oauthAccessTokens:
        AUTH_RECORD_CLEANUP_BATCH_SIZE +
        1 +
        preexistingExpired.oauthAccessTokens,
      oauthRefreshTokens:
        AUTH_RECORD_CLEANUP_BATCH_SIZE +
        1 +
        preexistingExpired.oauthRefreshTokens,
      deviceCodes:
        AUTH_RECORD_CLEANUP_BATCH_SIZE + 1 + preexistingExpired.deviceCodes,
    });
    for (const report of reports) {
      for (const deleted of Object.values(report)) {
        expect(deleted).toBeLessThanOrEqual(AUTH_RECORD_CLEANUP_BATCH_SIZE);
      }
    }

    expect(
      await prisma.session.count({
        where: {
          sessionToken: { startsWith: `${marker}-expired-session-` },
        },
      }),
    ).toBe(0);
    await expect(
      prisma.oAuthRefreshToken.findUnique({
        where: { token: `${marker}-revoked-future-refresh` },
      }),
    ).resolves.not.toBeNull();

    await expect(cleanupExpiredAuthRecords(prisma, cutoff)).resolves.toEqual({
      sessions: 0,
      verificationTokens: 0,
      oauthAccessTokens: 0,
      oauthRefreshTokens: 0,
      deviceCodes: 0,
    });

    expect(
      await prisma.session.count({
        where: {
          sessionToken: {
            in: [`${marker}-boundary-session`, `${marker}-future-session`],
          },
        },
      }),
    ).toBe(2);
    expect(
      await prisma.verificationToken.count({
        where: { token: `${marker}-boundary-verification` },
      }),
    ).toBe(1);
    expect(
      await prisma.deviceCode.count({
        where: { deviceCode: `${marker}-boundary-device` },
      }),
    ).toBe(1);
    expect(
      await prisma.oAuthAccessToken.count({
        where: {
          token: {
            in: [`${marker}-boundary-access`, `${marker}-future-access`],
          },
        },
      }),
    ).toBe(2);
    expect(
      await prisma.oAuthRefreshToken.count({
        where: {
          token: {
            in: [
              `${marker}-boundary-refresh`,
              `${marker}-revoked-future-refresh`,
            ],
          },
        },
      }),
    ).toBe(2);
  });
});
