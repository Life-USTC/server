import {
  AUTH_RECORD_CLEANUP_BATCH_SIZE,
  cleanupExpiredAuthRecords,
  type AuthRecordCleanupReport,
} from "@/features/auth/server/auth-record-cleanup";
import { createTestPrisma, disconnectTestPrisma } from "../shared/prisma";

const prisma = createTestPrisma();
const cutoff = new Date("1900-01-01T00:00:00.000Z");
const expiredAt = new Date(cutoff.getTime() - 60_000);
const futureAt = new Date(cutoff.getTime() + 60_000);
const marker = `auth-cleanup-${crypto.randomUUID()}`;

describe("expired auth record cleanup", () => {
  let userId: string;
  let clientId: string;

  beforeAll(async () => {
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
        {
          identifier: marker,
          token: `${marker}-expired-verification`,
          expires: expiredAt,
        },
        {
          identifier: marker,
          token: `${marker}-boundary-verification`,
          expires: cutoff,
        },
      ],
    });
    await prisma.deviceCode.createMany({
      data: [
        {
          deviceCode: `${marker}-expired-device`,
          userCode: `${marker}-expired-user-code`,
          clientId,
          userId,
          expiresAt: expiredAt,
        },
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
        {
          token: `${marker}-expired-refresh`,
          clientId,
          userId,
          expiresAt: expiredAt,
        },
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
        {
          token: `${marker}-expired-access`,
          clientId,
          userId,
          expiresAt: expiredAt,
        },
        {
          token: `${marker}-boundary-access`,
          clientId,
          userId,
          expiresAt: cutoff,
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

  test("runs concurrently in bounded, idempotent batches while preserving boundary and replay-detection rows", async () => {
    const reports = await Promise.all([
      cleanupExpiredAuthRecords(prisma, cutoff),
      cleanupExpiredAuthRecords(prisma, cutoff),
    ]);
    const total = reports.reduce<AuthRecordCleanupReport>(
      (sum, report) => ({
        sessions: sum.sessions + report.sessions,
        verificationTokens:
          sum.verificationTokens + report.verificationTokens,
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
      sessions: AUTH_RECORD_CLEANUP_BATCH_SIZE + 1,
      verificationTokens: 1,
      oauthAccessTokens: 1,
      oauthRefreshTokens: 1,
      deviceCodes: 1,
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
        where: { token: `${marker}-boundary-access` },
      }),
    ).toBe(1);
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
