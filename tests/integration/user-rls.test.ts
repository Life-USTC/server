import { readFileSync } from "node:fs";
import { Client } from "pg";
import { describe, expect } from "vitest";
import { updateAdminUser } from "@/features/admin/server/admin-api-service";
import { deleteOwnAccount } from "@/features/settings/server/account-deletion-service";
import { ensureUserCalendarFeedToken } from "@/features/subscriptions/server/calendar-feed-token";
import type { Prisma } from "@/generated/prisma/client";
import { rlsTest as it } from "../shared/rls-fixture";
import { staticImporterConnection } from "../shared/static-importer-connection";

describe.skipIf(process.env.RLS_TEST_ENABLED !== "true")(
  "User PostgreSQL write boundaries",
  { tags: ["@User/Permissions"] },
  () => {
    it("upgrades existing roles without rerunning bootstrap", async ({
      isolatedDatabase: { app, connections },
      rlsActors: { firstUserId },
    }) => {
      const owner = new Client({ connectionString: connections.owner });
      await owner.connect();
      try {
        await owner.query(`
          DROP TRIGGER enforce_user_app_update ON public."User";
          DROP FUNCTION public.enforce_user_app_update();
          DROP POLICY "User_existing_reads" ON public."User";
          DROP POLICY "User_auth_insert" ON public."User";
          DROP POLICY "User_service_update" ON public."User";
          DROP POLICY "User_account_delete" ON public."User";
          DROP POLICY "User_actor_update" ON public."User";
          ALTER TABLE public."User" DISABLE ROW LEVEL SECURITY;
        `);
        expect(
          await app.user.updateMany({
            where: { id: firstUserId },
            data: { name: "Before" },
          }),
        ).toEqual({ count: 1 });
        await owner.query(
          readFileSync(
            "prisma/migrations/20261104120000_user_write_rls/migration.sql",
            "utf8",
          ),
        );
        expect(
          await app.user.updateMany({
            where: { id: firstUserId },
            data: { name: "After" },
          }),
        ).toEqual({ count: 0 });
        expect(
          await app.user.findUnique({
            where: { id: firstUserId },
            select: { name: true },
          }),
        ).toEqual({ name: "Before" });
      } finally {
        await owner.end();
      }
    });
    it("rejects missing, empty, nonexistent and foreign actors without changing rows", async ({
      isolatedDatabase: { app, owner },
      rlsActors: { firstUserId, secondUserId },
    }) => {
      const before = await owner.user.findMany({ orderBy: { id: "asc" } });
      for (const actor of [undefined, "", "missing", secondUserId]) {
        expect(
          await app.$transaction(async (tx) => {
            if (actor !== undefined)
              await tx.$queryRaw`SELECT set_config('app.user_id', ${actor}, true)`;
            return tx.user.updateMany({
              where: { id: firstUserId },
              data: { name: "Forbidden", calendarFeedToken: "stolen" },
            });
          }),
        ).toEqual({ count: 0 });
      }
      expect(await owner.user.findMany({ orderBy: { id: "asc" } })).toEqual(
        before,
      );
      await expect(
        app.user.create({ data: { email: "forged@example.test" } }),
      ).rejects.toThrow(/permission denied/);
      await expect(app.user.deleteMany()).rejects.toThrow(/permission denied/);
    });

    it("preserves own personal writes including suspended owners but denies role escalation and immutable columns", async ({
      isolatedDatabase: { app, owner },
      rlsActors: { firstUserId, secondUserId },
    }) => {
      await owner.userSuspension.create({ data: { userId: firstUserId } });
      const write = (data: Prisma.UserUpdateInput) =>
        app.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT set_config('app.user_id', ${firstUserId}, true)`;
          return tx.user.update({ where: { id: firstUserId }, data });
        });
      await write({
        name: "Owner",
        username: "owner-name",
        profilePictures: ["https://example.test/avatar"],
        calendarFeedToken: "own-token",
      });
      for (const data of [
        { isAdmin: true },
        { name: "Partial escalation", isAdmin: true },
      ]) {
        await expect(write(data)).rejects.toThrow(/another administrator/);
      }
      for (const data of [
        { id: secondUserId },
        { email: "changed@example.test" },
        { emailVerified: true },
        { createdAt: new Date(0) },
        { image: "https://example.test/forged" },
      ]) {
        await expect(write(data)).rejects.toThrow(/permission denied/);
      }
      expect(
        await owner.user.findUniqueOrThrow({ where: { id: firstUserId } }),
      ).toMatchObject({
        name: "Owner",
        username: "owner-name",
        isAdmin: false,
        calendarFeedToken: "own-token",
      });
      expect(
        (await owner.user.findUniqueOrThrow({ where: { id: secondUserId } }))
          .name,
      ).toBe("");
      expect(
        await app.user.updateMany({
          where: { id: firstUserId },
          data: { name: "Leaked actor" },
        }),
      ).toEqual({ count: 0 });
    });

    it("allows admin profile and role changes while preserving private fields and self-demotion guard", async ({
      isolatedDatabase: { app, owner },
      rlsRuntime,
      rlsActors: { firstUserId, adminUserId },
    }) => {
      const write = (target: string, data: Prisma.UserUpdateInput) =>
        app.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT set_config('app.user_id', ${adminUserId}, true)`;
          return tx.user.update({ where: { id: target }, data });
        });
      for (const data of [
        { calendarFeedToken: "foreign-token" },
        { profilePictures: ["https://example.test/foreign"] },
        { name: "Partial", calendarFeedToken: "foreign-token" },
      ]) {
        await expect(write(firstUserId, data)).rejects.toThrow(
          /require their owner/,
        );
      }
      await expect(write(adminUserId, { isAdmin: false })).rejects.toThrow(
        /another administrator/,
      );
      await rlsRuntime.run(async () => {
        expect(
          await updateAdminUser(adminUserId, firstUserId, {
            name: "Managed",
            isAdmin: true,
          }),
        ).toMatchObject({ ok: true });
        expect(
          await updateAdminUser(adminUserId, firstUserId, { isAdmin: false }),
        ).toMatchObject({ ok: true });
      });
      expect(
        await owner.user.findUniqueOrThrow({ where: { id: firstUserId } }),
      ).toMatchObject({
        name: "Managed",
        isAdmin: false,
        calendarFeedToken: null,
        profilePictures: [],
      });
      expect(
        await owner.auditLog.count({
          where: { userId: adminUserId, action: "admin_user_role_update" },
        }),
      ).toBe(2);
      // Demotion is observed by the next statement even with the old actor ID.
      await owner.user.update({
        where: { id: adminUserId },
        data: { isAdmin: false },
      });
      expect(
        await app.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT set_config('app.user_id', ${adminUserId}, true)`;
          return tx.user.updateMany({
            where: { id: firstUserId },
            data: { name: "Revoked" },
          });
        }),
      ).toEqual({ count: 0 });
    });

    it("denies suspended governance but retains private owner settings and expired or lifted authority", async ({
      isolatedDatabase: { owner, app },
      rlsActors: { firstUserId, adminUserId },
    }) => {
      const update = (target: string) =>
        app.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT set_config('app.user_id', ${adminUserId}, true)`;
          return tx.user.updateMany({
            where: { id: target },
            data: { name: "Governance" },
          });
        });
      for (const state of [
        "indefinite",
        "future",
        "expired",
        "lifted",
      ] as const) {
        const suspension = await owner.userSuspension.create({
          data: {
            userId: adminUserId,
            expiresAt:
              state === "future"
                ? new Date(Date.now() + 3600000)
                : state === "expired"
                  ? new Date(0)
                  : null,
            liftedAt: state === "lifted" ? new Date() : null,
          },
        });
        if (state === "indefinite" || state === "future") {
          await expect(update(firstUserId)).rejects.toThrow(
            /active administrator/,
          );
          expect(
            (await owner.user.findUniqueOrThrow({ where: { id: firstUserId } }))
              .name,
          ).toBe("");
        } else {
          expect(await update(firstUserId)).toEqual({ count: 1 });
        }
        expect(await update(adminUserId)).toEqual({ count: 1 });
        await owner.userSuspension.delete({ where: { id: suspension.id } });
      }
    });

    it("retains auth column grants and denies importer and maintenance access", async ({
      isolatedDatabase: { app, auth, maintenance, name },
      rlsActors: { firstUserId },
    }) => {
      await auth.user.update({
        where: { id: firstUserId },
        data: {
          name: "Auth profile",
          username: "auth-profile",
          image: "https://example.test/auth",
        },
        select: { id: true },
      });
      for (const data of [
        { isAdmin: true },
        { calendarFeedToken: "auth-token" },
        { profilePictures: ["https://example.test/auth"] },
      ]) {
        await expect(
          auth.user.update({
            where: { id: firstUserId },
            data,
            select: { id: true },
          }),
        ).rejects.toThrow(/permission denied/);
      }
      await expect(
        auth.user.delete({ where: { id: firstUserId }, select: { id: true } }),
      ).rejects.toThrow(/permission denied/);
      for (const client of [maintenance]) {
        await expect(
          client.user.findMany({ select: { id: true } }),
        ).rejects.toThrow(/permission denied/);
        await expect(
          client.user.updateMany({ data: { name: "Forbidden" } }),
        ).rejects.toThrow(/permission denied/);
      }
      const importer = new Client({
        connectionString: staticImporterConnection(name),
      });
      await importer.connect();
      try {
        await expect(
          importer.query('SELECT id FROM public."User"'),
        ).rejects.toThrow(/permission denied/);
        await expect(
          importer.query('UPDATE public."User" SET name = $1', ["Forbidden"]),
        ).rejects.toThrow(/permission denied/);
      } finally {
        await importer.end();
      }
      expect(
        await app.user.findUnique({
          where: { id: firstUserId },
          select: { name: true, username: true, image: true },
        }),
      ).toEqual({
        name: "Auth profile",
        username: "auth-profile",
        image: "https://example.test/auth",
      });
    });

    it("preserves actor-aware token creation, public projections and account-deletion cascades", async ({
      isolatedDatabase: { owner, app },
      rlsRuntime,
      rlsActors: { firstUserId, secondUserId },
      rlsSections: { sectionId },
    }) => {
      await owner.userSectionSubscription.create({
        data: { userId: firstUserId, sectionId },
      });
      await owner.todo.create({
        data: { userId: firstUserId, title: "Private todo" },
      });
      const session = await owner.session.create({
        data: {
          userId: firstUserId,
          sessionToken: crypto.randomUUID(),
          createdAt: new Date(),
          expires: new Date(Date.now() + 3600000),
        },
      });
      await rlsRuntime.run(async () => {
        expect(await ensureUserCalendarFeedToken(firstUserId)).toBeTruthy();
        expect(
          await app.user.findUnique({
            where: { id: firstUserId },
            select: { id: true },
          }),
        ).toEqual({ id: firstUserId });
        expect(
          await deleteOwnAccount(firstUserId, { sessionId: session.id }),
        ).toMatchObject({ ok: true });
      });
      expect(
        await owner.user.findUnique({ where: { id: firstUserId } }),
      ).toBeNull();
      expect(
        await owner.user.findUnique({ where: { id: secondUserId } }),
      ).not.toBeNull();
      expect(await owner.todo.count()).toBe(0);
      expect(await owner.userSectionSubscription.count()).toBe(0);
      const [security] = await app.$queryRaw<
        { enabled: boolean; forced: boolean }[]
      >`SELECT relrowsecurity AS enabled, relforcerowsecurity AS forced FROM pg_class WHERE oid = 'public."User"'::regclass`;
      expect(security).toEqual({ enabled: true, forced: true });
    });
  },
);
