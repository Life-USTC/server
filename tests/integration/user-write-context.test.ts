import { makeSignature } from "better-auth/crypto";
import { describe, expect } from "vitest";
import { updateAdminUser } from "@/features/admin/server/admin-api-service";
import { updateOwnProfile } from "@/features/profile/server/profile-update-service";
import {
  ensureUserCalendarFeedToken,
  rotateUserCalendarFeedToken,
} from "@/features/subscriptions/server/calendar-feed-token";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { syncSocialVerifiedEmailFromAccountHook } from "@/lib/auth/social-verified-email-plugin";
import { stageSocialVerifiedEmail } from "@/lib/auth/social-verified-email-staging";
import { withUserDbContext } from "@/lib/db/prisma";
import type { IsolatedDatabase } from "../shared/isolated-database";
import { nodeProtocolTest as it } from "../shared/node-protocol-fixture";

const ownerId = "user-context-owner";
const otherId = "user-context-other";
const adminId = "user-context-admin";

// A test-only policy probes the application preparation before production RLS
// is enabled. It deliberately does not define the eventual User access policy.
async function prepareWriteProbe(db: IsolatedDatabase, actor = ownerId) {
  await db.owner.user.createMany({
    data: [ownerId, otherId, adminId].map((id) => ({
      id,
      email: `${id}@example.test`,
      isAdmin: id === adminId,
    })),
  });
  await db.owner.$executeRawUnsafe(
    'ALTER TABLE "User" ENABLE ROW LEVEL SECURITY',
  );
  await db.owner.$executeRawUnsafe(
    'ALTER TABLE "User" FORCE ROW LEVEL SECURITY',
  );
  await db.owner.$executeRawUnsafe(
    'CREATE POLICY "User_probe_read" ON "User" FOR SELECT USING (true)',
  );
  await db.owner.$executeRawUnsafe(
    `CREATE POLICY "User_probe_app_update" ON "User" AS RESTRICTIVE FOR UPDATE TO life_ustc_runtime
     USING (current_setting('app.user_id', true) = '${actor}')
     WITH CHECK (current_setting('app.user_id', true) = '${actor}')`,
  );
  await db.owner.$executeRawUnsafe(
    'CREATE POLICY "User_probe_auth_update" ON "User" FOR UPDATE TO life_ustc_auth_runtime USING (true) WITH CHECK (true)',
  );
  // Establish that using the unscoped runtime client really fails the probe.
  expect(
    await db.app.user.updateMany({
      where: { id: ownerId },
      data: { name: "Unscoped" },
    }),
  ).toEqual({ count: 0 });
}

async function sessionHeaders(db: IsolatedDatabase) {
  const token = crypto.randomUUID();
  await db.owner.session.create({
    data: {
      userId: ownerId,
      sessionToken: token,
      createdAt: new Date(),
      expires: new Date(Date.now() + 3600000),
    },
  });
  const context = await getBetterAuthInstance().$context;
  return new Headers({
    origin: "http://localhost:3000",
    cookie: `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, context.secret)}`)}`,
  });
}

describe("User application writes before row security", {
  tags: ["@User/Permissions"],
}, () => {
  it("preserves concurrent token initialization, rotation and context cleanup", async ({
    isolatedDatabase: db,
    protocolRuntime,
  }) => {
    await prepareWriteProbe(db);
    await protocolRuntime.run(async () => {
      const tokens = await Promise.all([
        ensureUserCalendarFeedToken(ownerId),
        ensureUserCalendarFeedToken(ownerId),
      ]);
      expect(tokens[0]).toBeTruthy();
      expect(tokens[1]).toBe(tokens[0]);
      const headers = await sessionHeaders(db);
      const rotated = await rotateUserCalendarFeedToken(ownerId, headers);
      expect(rotated.ok).toBe(true);
      if (!rotated.ok) throw new Error(rotated.reason);
      expect(rotated.token).not.toBe(tokens[0]);
      expect(
        (await db.owner.user.findUniqueOrThrow({ where: { id: ownerId } }))
          .calendarFeedToken,
      ).toBe(rotated.token);
      expect(
        (await db.owner.user.findUniqueOrThrow({ where: { id: otherId } }))
          .calendarFeedToken,
      ).toBeNull();
      await expect(
        withUserDbContext(otherId, () =>
          rotateUserCalendarFeedToken(ownerId, headers),
        ),
      ).rejects.toThrow("Cannot change RLS user");
      expect(
        await db.app.user.updateMany({
          where: { id: ownerId },
          data: { calendarFeedToken: "leaked" },
        }),
      ).toEqual({ count: 0 });
      const audits = await db.owner.auditLog.findMany({
        where: {
          action: {
            in: [
              "account_calendar_token_create",
              "account_calendar_token_rotate",
            ],
          },
        },
      });
      expect(
        audits.filter((row) => row.action === "account_calendar_token_create"),
      ).toHaveLength(1);
      expect(
        audits.filter(
          (row) =>
            row.action === "account_calendar_token_rotate" &&
            row.outcome === "success",
        ),
      ).toHaveLength(1);
      expect(JSON.stringify(audits)).not.toContain(rotated.token);
      expect(
        (await db.owner.user.findUniqueOrThrow({ where: { id: ownerId } }))
          .calendarFeedToken,
      ).toBe(rotated.token);
    });
  });

  it("persists the processed avatar after the authenticated profile update", async ({
    isolatedDatabase: db,
    protocolRuntime,
  }) => {
    await prepareWriteProbe(db);
    await protocolRuntime.run(async () => {
      const image = `/media/avatars/${ownerId}/${crypto.randomUUID()}.webp`;
      expect(
        await updateOwnProfile({
          headers: await sessionHeaders(db),
          userId: ownerId,
          name: "Prepared profile",
          username: "prepared-profile",
          image,
          trustedImageUrl: image,
        }),
      ).toMatchObject({ ok: true });
      expect(
        await db.owner.user.findUniqueOrThrow({ where: { id: ownerId } }),
      ).toMatchObject({
        name: "Prepared profile",
        username: "prepared-profile",
        image,
        profilePictures: [image],
        isAdmin: false,
      });
      expect(
        (await db.owner.user.findUniqueOrThrow({ where: { id: otherId } }))
          .profilePictures,
      ).toEqual([]);
      expect(
        await db.app.user.updateMany({
          where: { id: ownerId },
          data: { profilePictures: [] },
        }),
      ).toEqual({ count: 0 });
    });
  });

  it("persists social avatar choices through the app actor without widening auth grants", async ({
    isolatedDatabase: db,
    protocolRuntime,
  }) => {
    await prepareWriteProbe(db);
    await protocolRuntime.run(async () => {
      const image = "https://example.test/social-avatar.png";
      stageSocialVerifiedEmail({
        provider: "oidc",
        accountId: "context-oidc",
        email: null,
        emailVerified: false,
        image,
      });
      await syncSocialVerifiedEmailFromAccountHook({
        providerId: "oidc",
        accountId: "context-oidc",
        userId: ownerId,
      });
      expect(
        await db.owner.user.findUniqueOrThrow({ where: { id: ownerId } }),
      ).toMatchObject({ image, profilePictures: [image] });
      expect(
        (await db.owner.user.findUniqueOrThrow({ where: { id: otherId } }))
          .profilePictures,
      ).toEqual([]);
      expect(
        await db.app.user.updateMany({
          where: { id: ownerId },
          data: { profilePictures: [] },
        }),
      ).toEqual({ count: 0 });
    });
  });

  it("uses the admin actor rather than the target in the serializable update", async ({
    isolatedDatabase: db,
    protocolRuntime,
  }) => {
    await prepareWriteProbe(db, adminId);
    await protocolRuntime.run(async () => {
      expect(
        await updateAdminUser(adminId, otherId, {
          name: "Admin edited",
          isAdmin: true,
        }),
      ).toMatchObject({ ok: true });
      expect(
        await db.owner.user.findUniqueOrThrow({ where: { id: otherId } }),
      ).toMatchObject({ name: "Admin edited", isAdmin: true });
      expect(
        (await db.owner.user.findUniqueOrThrow({ where: { id: ownerId } }))
          .isAdmin,
      ).toBe(false);
      expect(
        await db.owner.auditLog.findMany({
          where: { subjectUserId: otherId },
          select: { action: true, userId: true },
        }),
      ).toEqual(
        expect.arrayContaining([
          { action: "admin_user_profile_update", userId: adminId },
          { action: "admin_user_role_update", userId: adminId },
        ]),
      );
      expect(
        await db.app.user.updateMany({
          where: { id: otherId },
          data: { isAdmin: false },
        }),
      ).toEqual({ count: 0 });
    });
  });
});
